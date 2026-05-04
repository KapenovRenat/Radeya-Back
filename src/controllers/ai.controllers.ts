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
            forecastQty: number;
            deliveryDays: number;
            destination: string;
        };
        editedItems?: any[];
        additionalPrompt?: string;
    };

    const itemLines = items.map((item: any) => {
        const daysLeft = item.salesPerDay > 0
            ? +(item.available / item.salesPerDay).toFixed(1)
            : null;
        return [
            `"${item.name ?? "—"}"`,
            `код:${item.code ?? "—"}`,
            `объём:${item.volume ?? 0}м³`,
            `прод/день:${item.salesPerDay}`,
            `доступно:${item.available}`,
            `дней:${daysLeft ?? "∞"}`,
            `рент-ть:${item.profitPct ?? 0}%`,
        ].join(" | ");
    }).join("\n");

    const editedBlock = editedItems?.length
        ? `\nПОЛЬЗОВАТЕЛЬ СКОРРЕКТИРОВАЛ СПИСОК:\n` +
          editedItems.map((e: any) => `- ${e.name} (${e.code}): заказать ${e.qty} шт, срок ${e.deliveryDays} дн`).join("\n")
        : "";

    const extraBlock = additionalPrompt
        ? `\nДОПОЛНИТЕЛЬНЫЕ ПОЖЕЛАНИЯ:\n${additionalPrompt}`
        : "";

    const prompt = `Ты — менеджер по закупкам мебельного магазина. Составь оптимальный список закупки на ОДНУ машину.

ПАРАМЕТРЫ:
- Куда: ${params.destination}
- Срок доставки: ${params.deliveryDays} дней
- Период между заказами: ${params.forecastDays} дней
- Объём машины: ${params.truckVol} м³ — это общий лимит на весь заказ

ЛОГИКА РАСЧЁТА:
1. Рассчитай нужное кол-во каждого товара: прод/день × (${params.deliveryDays} + ${params.forecastDays}) - доступно (минимум 1)
2. Рассчитай объём каждой позиции: кол-во × объём_товара (если объём = 0 — объём позиции считай нулевым)
3. Сложи суммарный объём всех позиций
4. Если суммарный объём > ${params.truckVol} м³ — урежь количества, начиная с наименее приоритетных товаров (низкая маржа, много дней остатка), пока суммарный объём не войдёт в ${params.truckVol} м³
5. Товары с объёмом = 0 означают что объём неизвестен. Включай их в список закупки если нужны по продажам, но не учитывай их объём при подсчёте суммарного объёма машины. В поле totalItemVolume для таких товаров ставь null, в comment пиши "объём не указан"
6. В поле totalVolume итогового JSON укажи суммарный объём заказа
${editedBlock}${extraBlock}

ДАННЫЕ (наименование | код | объём | прод/день | доступно | дней | рент-ть):
${itemLines}

Верни ТОЛЬКО валидный JSON без markdown, без пояснений:
{
  "items": [
    {
      "name": "название",
      "code": "код",
      "qty": 5,
      "deliveryDays": 3,
      "itemVolume": 0.288,
      "totalItemVolume": 1.44,
      "profitPct": 45.5,
      "comment": "короткий комментарий"
    }
  ],
  "totalVolume": 32.5,
  "truckFillPct": 92,
  "summary": "краткое резюме на русском"
}`;

    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    let message: any;
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            message = await client.messages.create({
                model: "claude-opus-4-5",
                max_tokens: 8096,
                messages: [{ role: "user", content: prompt }],
            });
            break;
        } catch (err: any) {
            const status = err?.status ?? err?.statusCode ?? 0;
            const isOverloaded = status === 529 || err?.message?.includes("overloaded");

            if (isOverloaded && attempt < maxAttempts) {
                const wait = attempt * 15_000;
                console.log(`[AI] Overloaded, retry ${attempt}/${maxAttempts} after ${wait / 1000}s...`);
                await sleep(wait);
                continue;
            }

            if (isOverloaded) {
                res.status(503).json({ error: "Серверы AI временно перегружены. Подождите 1–2 минуты и попробуйте снова." });
                return;
            }

            throw err;
        }
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

    res.json(parsed);
}
