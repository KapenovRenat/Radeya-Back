import { Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { Env } from "@config/env";

const client = new Anthropic({ apiKey: Env.ANTHROPIC_API_KEY, maxRetries: 0 });

export async function aiPurchaseAnalysis(req: Request, res: Response) {
    const { items, params, editedItems, additionalPrompt } = req.body as {
        items: any[];
        params: {
            truckVol: number;
            forecastDays: number;
            deliveryDays: number;
            coverageDays: number;
            minSalesPerDay: number;
            destination: string;
        };
        editedItems?: any[];
        additionalPrompt?: string;
    };

    const totalLeadDays = params.forecastDays + params.deliveryDays;
    const safetyBuffer  = Math.max(0, params.coverageDays - totalLeadDays);

    // Сортируем: сначала самые срочные (мало дней)
    const itemsSorted = [...items].sort((a: any, b: any) => {
        const da = a.salesPerDay > 0 ? a.available / a.salesPerDay : 9999;
        const db = b.salesPerDay > 0 ? b.available / b.salesPerDay : 9999;
        return da - db;
    });

    const itemLines = itemsSorted.map((item: any) => {
        const daysLeft = item.salesPerDay > 0
            ? +(item.available / item.salesPerDay).toFixed(1)
            : null;
        const name = (item.name ?? "—").replace(/"/g, "'").replace(/\n/g, " ");
        return [
            name,
            item.code ?? "—",
            `${item.volume ?? 0}м³`,
            `${item.salesPerDay}/д`,
            `д:${item.available}`,
            `${daysLeft ?? "∞"}дн`,
            `${item.profitPct ?? 0}%`,
        ].join("|");
    }).join("\n");

    // Явный список КРИТИЧНО — вычисляем на бэкенде
    const criticalItems = itemsSorted.filter((item: any) => {
        const daysLeft = item.salesPerDay > 0 ? item.available / item.salesPerDay : 9999;
        return daysLeft < totalLeadDays && item.salesPerDay >= params.minSalesPerDay;
    });
    const criticalBlock = criticalItems.length > 0
        ? `\n⚠️ КРИТИЧНО — ВКЛЮЧИТЬ ВСЕ ОБЯЗАТЕЛЬНО (${criticalItems.length} позиций, закончатся до прихода заказа):\n` +
          criticalItems.map((item: any) => {
              const daysLeft = item.salesPerDay > 0 ? +(item.available / item.salesPerDay).toFixed(1) : "∞";
              const neededQty = Math.max(2, Math.ceil(item.salesPerDay * params.coverageDays - item.available));
              return `- ${item.code} | ${(item.name ?? "").replace(/"/g, "'")} | остаток:${item.available} | ${daysLeft}дн | ${item.salesPerDay}/д | нужно:${neededQty}шт`;
          }).join("\n")
        : "";

    const editedBlock = editedItems?.length
        ? `\nПОЛЬЗОВАТЕЛЬ СКОРРЕКТИРОВАЛ СПИСОК:\n` +
          editedItems.map((e: any) => `- ${e.name} (${e.code}): заказать ${e.qty} шт, срок ${e.deliveryDays} дн`).join("\n")
        : "";

    const extraBlock = additionalPrompt
        ? `\nДОПОЛНИТЕЛЬНЫЕ ПОЖЕЛАНИЯ:\n${additionalPrompt}`
        : "";

    const prompt = `Ты — опытный менеджер по закупкам мебельного магазина с 10-летним стажем. Составь оптимальный список закупки на ОДНУ машину и дай профессиональный анализ по каждой позиции.

ПАРАМЕТРЫ ЗАКАЗА:
- Куда: ${params.destination}
- Срок изготовления: ${params.forecastDays} дней
- Срок доставки: ${params.deliveryDays} дней
- Полный срок заказа: ${totalLeadDays} дней (изготовление + доставка)
- Горизонт покрытия: ${params.coverageDays} дней (запас сверх полного срока: +${safetyBuffer} дн)
- Объём машины: ${params.truckVol} м³ — жёсткий лимит

ФИЛЬТР ТОВАРОВ:
- Для КРИТИЧНО / СРОЧНО / ПЛАНОВЫЙ: только товары с прод/день ≥ ${params.minSalesPerDay}
- Для ДОПОЛНИТЕЛЬНО (заполнение машины): можно использовать любые товары с прод/день > 0

КЛАССИФИКАЦИЯ СРОЧНОСТИ:
- КРИТИЧНО: дней_остатка < ${totalLeadDays} — товар закончится ДО прихода заказа, потери продаж гарантированы
- СРОЧНО: ${totalLeadDays} ≤ дней_остатка < ${totalLeadDays + Math.round(safetyBuffer / 2)} — придёт вовремя, но буфер минимален
- ПЛАНОВЫЙ: ${totalLeadDays + Math.round(safetyBuffer / 2)} ≤ дней_остатка < ${params.coverageDays} — плановое пополнение, есть запас
- ДОПОЛНИТЕЛЬНО (заполнение машины): дней_остатка ≥ ${params.coverageDays} — только для дозаполнения свободного места

РАСЧЁТ КОЛИЧЕСТВА:
- Базовое кол-во = прод/день × ${params.coverageDays} - доступно (минимум 2)
- Приоритет при равной срочности: выше маржа → выше продажи

ЗАПОЛНЕНИЕ МАШИНЫ (для товаров с объёмом > 0):

ШАГ 1 — КРИТИЧНО (дней_остатка < ${totalLeadDays}) — ОБЯЗАТЕЛЬНО ВСЕ:
- Включай КАЖДЫЙ такой товар без исключения, даже если машина переполнится
- Кол-во = прод/день × ${params.coverageDays} - доступно (минимум 2)

ШАГ 2 — СРОЧНО и ПЛАНОВЫЙ (${totalLeadDays} ≤ дней_остатка < ${params.coverageDays}):
- Добавляй по убыванию прод/день пока есть место
- Если места не хватает — урезай кол-во пропорционально, но не убирай совсем (минимум 2)

ШАГ 3 — ДОЗАПОЛНЕНИЕ (если осталось > 1 м³ после шагов 1-2):
- СТРОГО: только товары которых НЕТ в шагах 1-2 (разные коды!)
- Максимум 5 позиций ДОПОЛНИТЕЛЬНО, выбирай по убыванию прод/день
- Кол-во = max(2, ceil(прод/день × ${params.coverageDays} - доступно)) — ЖЁСТКИЙ ПОТОЛОК, больше не брать!
- Добавляй пока суммарный объём ≤ 95% машины, если не хватает кандидатов — пиши реальный %
- ЖЁСТКОЕ ОГРАНИЧЕНИЕ: суммарный объём одного ДОПОЛНИТЕЛЬНО товара ≤ 25% свободного объёма

ШАГ 4 — если суммарный объём > ${params.truckVol} м³:
- Урезай СРОЧНО/ПЛАНОВЫЙ/ДОПОЛНИТЕЛЬНО пропорционально прод/день, минимум 2
- КРИТИЧНО — не трогать!

Товары с объёмом = 0: только из шагов 1-2, totalItemVolume = null

ТРЕБОВАНИЯ К КОММЕНТАРИЮ (поле comment):
Начни с метки: КРИТИЧНО / СРОЧНО / ПЛАНОВЫЙ / ДОПОЛНИТЕЛЬНО (заполнение машины)
Затем напиши 1-2 предложения как опытный закупщик: укажи остаток, динамику продаж, почему именно такое количество, на что обратить внимание. Например: "КРИТИЧНО: остаток 0, продаётся 0.35/д — топовая позиция, заказываем 11 шт на 30 дней покрытия." или "ПЛАНОВЫЙ: остаток 4 шт (28 дней), заказываем минимум 2 шт — подстраховка на случай роста продаж."

ТРЕБОВАНИЯ К РЕЗЮМЕ (поле summary):
Напиши развёрнутый профессиональный анализ заказа (5-8 предложений):
- Общая картина: сколько позиций, заполнение машины, общее покрытие
- Критические позиции: какие товары в дефиците и почему это важно
- Структура заказа: соотношение критичных/плановых/дополнительных
- Риски: что может пойти не так
- Рекомендации: на что обратить внимание при следующем заказе

ЦЕЛЬ ПО МАШИНЕ: truckFillPct должен быть ≥ 95%

ПОЛЯ JSON ДЛЯ КАЖДОЙ ПОЗИЦИИ:
- qty = итоговое кол-во с учётом машины (минимум 2)
- neededQty = идеальное кол-во без ограничения машины (минимум 2; для ДОПОЛНИТЕЛЬНО = qty)
- code = ТОЧНЫЙ код из данных, БЕЗ каких-либо изменений, суффиксов или добавлений (не "-DOZ", не "-ADD", ничего!)
${criticalBlock}${editedBlock}${extraBlock}

ДАННЫЕ (наименование|код|объём|прод/день|доступно|дней|рент-ть, отсортировано по срочности):
${itemLines}

Верни ТОЛЬКО валидный JSON без markdown, без пояснений:
{
  "items": [
    {
      "name": "название",
      "code": "код",
      "qty": 5,
      "neededQty": 8,
      "deliveryDays": ${params.deliveryDays},
      "itemVolume": 0.288,
      "totalItemVolume": 1.44,
      "profitPct": 45.5,
      "comment": "КРИТИЧНО/СРОЧНО/ПЛАНОВЫЙ + короткий комментарий"
    }
  ],
  "totalVolume": 32.5,
  "truckFillPct": 92,
  "summary": "развёрнутый профессиональный анализ заказа на русском языке"
}`;

    let message: any;
    try {
        message = await client.messages.create({
            model: "claude-opus-4-7",
            max_tokens: 16000,
            messages: [{ role: "user", content: prompt }],
        });
    } catch (err: any) {
        const status = err?.status ?? err?.response?.status;
        if (status === 529 || err?.message?.includes("overloaded")) {
            res.status(503).json({ error: "Серверы AI перегружены, попробуйте позже." });
            return;
        }
        throw err;
    }

    const raw = (message.content[0] as any).text as string;
    console.log("[AI raw response]", raw.slice(0, 500));

    // Пытаемся извлечь JSON разными способами
    let parsed: any;
    try {
        // 1. Убираем ```json ... ``` или ``` ... ```
        const stripped = raw
            .replace(/^```json\s*/im, "")
            .replace(/^```\s*/im, "")
            .replace(/```\s*$/im, "")
            .trim();

        // 2. Ищем первую { и последнюю }
        const start = stripped.indexOf("{");
        const end   = stripped.lastIndexOf("}");
        if (start === -1 || end === -1) throw new Error("No JSON object found");

        parsed = JSON.parse(stripped.slice(start, end + 1));
    } catch (e: any) {
        console.error("[AI parse error]", e.message, "\nRaw:", raw);
        res.status(500).json({ error: `Ошибка парсинга ответа AI: ${e.message}`, raw });
        return;
    }

    // Пост-обработка: жёстко капаем кол-во ДОПОЛНИТЕЛЬНО по формуле покрытия
    // AI иногда игнорирует промпт и раздувает qty — исправляем программно
    if (Array.isArray(parsed.items)) {
        const itemMap = new Map(items.map((i: any) => [i.code, i]));
        parsed.items = parsed.items.map((item: any) => {
            if (typeof item.comment === "string" && item.comment.startsWith("ДОПОЛНИТЕЛЬНО")) {
                const src = itemMap.get(item.code);
                if (src && src.salesPerDay > 0) {
                    const maxQty = Math.max(2, Math.ceil(src.salesPerDay * params.coverageDays - src.available));
                    if (item.qty > maxQty) {
                        console.log(`[AI cap] ДОПОЛНИТЕЛЬНО ${item.code}: qty ${item.qty} → ${maxQty}`);
                        item.qty = maxQty;
                    }
                    item.neededQty = Math.max(2, Math.ceil(src.salesPerDay * params.coverageDays - src.available));
                    // Пересчитываем totalItemVolume
                    if (item.itemVolume > 0) {
                        item.totalItemVolume = +(item.qty * item.itemVolume).toFixed(3);
                    }
                }
            }
            return item;
        });

        // Пересчитываем totalVolume и truckFillPct после коррекции
        const newTotal = parsed.items.reduce((sum: number, it: any) => sum + (it.totalItemVolume ?? 0), 0);
        parsed.totalVolume = +newTotal.toFixed(2);
        parsed.truckFillPct = +(newTotal / params.truckVol * 100).toFixed(1);
    }

    res.json(parsed);
}
