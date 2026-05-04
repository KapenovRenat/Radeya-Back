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
            destination: string;
        };
        editedItems?: any[];
        additionalPrompt?: string;
    };

    const itemLines = items.map((item: any) => {
        const daysLeft = item.salesPerDay > 0
            ? +(item.available / item.salesPerDay).toFixed(1)
            : null;
        // Убираем кавычки из названий чтобы не ломать JSON в ответе
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
- Объём машины: ${params.truckVol} м³ — это жёсткий лимит

ЛОГИКА РАСЧЁТА:
1. Приоритет товаров: сначала самые срочные (мало дней остатка), при равенстве — выше маржа
2. Для товаров с известным объёмом (объём > 0):
   - Рассчитай нужное кол-во: прод/день × (${params.deliveryDays} + ${params.forecastDays}) - доступно (минимум 1)
   - Проверь суммарный объём: кол-во × объём товара
   - Заполняй машину пока суммарный объём не достигнет ${params.truckVol} м³
   - Если товар не влезает целиком — урежь кол-во до максимума влезающего в оставшееся место
3. Для товаров с объёмом = 0 (объём неизвестен):
   - Включай по потребности продаж, не считай их объём
   - totalItemVolume = null, в comment пиши "объём не указан"
4. В totalVolume укажи суммарный объём только товаров с известным объёмом
5. truckFillPct = round(totalVolume / ${params.truckVol} * 100)
${editedBlock}${extraBlock}

ДАННЫЕ (наименование|код|объём|прод/день|доступно|дней|рент-ть):
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

    res.json(parsed);
}
