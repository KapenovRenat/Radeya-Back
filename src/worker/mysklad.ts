import axios from "axios";
import { Env } from "@config/env";
import {SkladProduct} from "@models/mysklad/SkladProduct";
import mongoose from "mongoose";

/**
 * Простой воркер: Basic-авторизация по логину/паролю и вывод сырого JSON.
 * Без маппинга, без записи в БД — только консоль.
 */

// --- ENV
const BASE = Env.MOYSKLAD_BASE || "https://api.moysklad.ru/api/remap/1.2";
const LOGIN = Env.MOYSKLAD_LOGIN;
const PASSWORD = Env.MOYSKLAD_PASSWORD;

if (!LOGIN || !PASSWORD) {
    console.error("❌ Укажи MOYSKLAD_LOGIN и MOYSKLAD_PASSWORD в .env");
    process.exit(1);
}

// --- Axios instance c Basic Auth
const basic = Buffer.from(`${LOGIN}:${PASSWORD}`).toString("base64");
const ms = axios.create({
    baseURL: BASE,
    timeout: 30_000,
    headers: {
        Accept: "application/json;charset=utf-8",
        "Content-Type": "application/json;charset=utf-8",
        Authorization: `Basic ${basic}`,
    },
});

// --- Утилиты для красивого вывода
const pretty = (obj: any) => JSON.stringify(obj, null, 2);

// ─────────────────────── helpers: sleep / retry / mapLimit ───────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function retry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
    let lastErr: any;
    for (let i = 0; i < attempts; i++) {
        try {
            return await fn();
        } catch (e: any) {
            lastErr = e;
            const status = e?.response?.status;
            // только для 429/5xx подождём и повторим
            if (status === 429 || status >= 500) {
                await sleep(400 * (i + 1));
                continue;
            }
            break;
        }
    }
    throw lastErr;
}

async function mapLimit<T, R>(
    items: T[],
    limit: number,
    iter: (x: T, idx: number) => Promise<R>
): Promise<R[]> {
    const out: R[] = new Array(items.length);
    let i = 0;

    const workers = Array(Math.min(limit, items.length))
        .fill(0)
        .map(async () => {
            while (true) {
                const idx = i++;
                if (idx >= items.length) break;
                out[idx] = await iter(items[idx], idx);
            }
        });

    await Promise.all(workers);
    return out;
}

// ─────────────────────── API calls ───────────────────────
async function getProductsPage(limit: number, offset: number): Promise<any> {
    const { data } = await ms.get("/entity/product", { params: { limit, offset } });
    return data; // { meta:{size,limit,offset,nextHref...}, rows:[...] }
}

async function getMiniatureFromHref(imagesHref: string): Promise<string | null> {
    return retry(async () => {
        // просим только одну картинку
        const url = imagesHref.includes("?")
            ? `${imagesHref}&limit=1`
            : `${imagesHref}?limit=1`;
        const { data } = await ms.get(url);
        const first = data?.rows?.[0];
        return first?.miniature?.href || null;
    });
}

// ─────────────────────── Main ───────────────────────
async function main() {
    const LIMIT = 100; // максимум в Remap 1.2 — 100
    let offset = 0;

    console.log("🔄 Загружаю товары из МойСклад…");
    const first = await getProductsPage(LIMIT, offset);
    const total: number = first?.meta?.size ?? (first?.rows?.length || 0);
    console.log(`📦 Всего товаров: ${total}`);

    let pageRows: any[] = first.rows ?? [];
    const results: any[] = [];

    while (pageRows.length) {
        const processed = await mapLimit(
            pageRows,
            2, // ограничиваем параллельные запросы к /images
            async (row) => {
                let miniatureUrl: string | null = null;

                if (row.images?.meta?.href) {
                    try {
                        miniatureUrl = await getMiniatureFromHref(row.images.meta.href);
                    } catch (e: any) {
                        console.warn(
                            `⚠ Миниатюра не получена для товара ${row.id}:`,
                            e?.response?.status || e?.message
                        );
                    }
                }

                // поиск значений в attributes (как обсуждали)
                const supplierAttr = row.attributes?.find((a: any) => a.type === "long");
                const kaspiLinkAttr = row.attributes?.find((a: any) => a.type === "link");
                const kaspiPriceItem = row.salePrices?.find(
                    (p: any) => p?.priceType?.name?.toLowerCase().includes("касп")
                        || p?.priceType?.name?.toLowerCase().includes("kaspi")
                );


                const pro = {
                    msId: row.id,
                    name: row.name || null,
                    article: row.code || null,
                    updatedAtMs: row.updated || null,
                    imageUrl: miniatureUrl, // ← миниатюра

                    supplier: {
                        name: supplierAttr?.name ?? null,
                        count: supplierAttr?.value ?? null,
                    },

                    // Денежные поля из МС — в копейках/тиынах → делим на 100 для KZT
                    purchasePrice:
                        row.buyPrice?.value != null ? row.buyPrice.value / 100 : null,
                    kaspiPrice:
                        kaspiPriceItem?.value != null ? kaspiPriceItem.value / 100 : null,

                    kaspiLink: kaspiLinkAttr?.value ?? null,
                }

                // СРАЗУ сохраняем (upsert) — ключ по msId
                const res = await SkladProduct.updateOne(
                    { msId: pro.msId },
                    { $set: pro },
                    { upsert: true }
                );

                return {
                    msId: row.id,
                    name: row.name || null,
                    article: row.code || null,
                    updatedAtMs: row.updated || null,
                    imageUrl: miniatureUrl, // ← миниатюра

                    supplier: {
                        name: supplierAttr?.name ?? null,
                        count: supplierAttr?.value ?? null,
                    },

                    // Денежные поля из МС — в копейках/тиынах → делим на 100 для KZT
                    purchasePrice:
                        row.buyPrice?.value != null ? row.buyPrice.value / 100 : null,
                    kaspiPrice:
                        kaspiPriceItem?.value != null ? kaspiPriceItem.value / 100 : null,

                    kaspiLink: kaspiLinkAttr?.value ?? null,
                };
            }
        );

        results.push(...processed);
        console.log(`→ Обработано ${Math.min(offset + pageRows.length, total)}/${total}`);

        offset += LIMIT;
        if (offset >= total) break;

        const next = await getProductsPage(LIMIT, offset);
        pageRows = next.rows ?? [];
    }

    console.log(`\n✅ Готово. Сводка: ${results.length} товаров.`);
    // Печатаем первые 5 для проверки
    // console.dir(results.slice(0, 5), { depth: null });
}

mongoose
    .connect(Env.MONGODB_URI)
    .then(() => {
        console.log("✅ MongoDB connected");
        main().catch((e) => {
            console.error("❌ Ошибка:", e?.response?.data || e?.message || e);
            process.exit(1);
        });
    })
    .catch((err) => {
        console.error("MongoDB connection error:", err);
        process.exit(1);
    });

