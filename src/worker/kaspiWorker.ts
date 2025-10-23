import axios from "axios";
import { Env } from "@config/env";
import { Order } from "@models/orders/Order";
import mongoose from "mongoose";
import cron from "node-cron";

const pretty = (obj: any) => JSON.stringify(obj, null, 2);

// Небольшая задержка между запросами (мс)
const SLEEP_MS = 150;
// Включить ли подтягивание детальной информации о продукте для каждой позиции
// (!) Если заказов много — лучше оставить false. Можно сделать флаг из .env
const FETCH_PRODUCT_DETAILS = false;

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

export const kaspiApi = axios.create({
    baseURL: Env.KASPI_API_URL, // например: https://kaspi.kz/shop/api/v2
    headers: {
        "X-Auth-Token": Env.KASPI_API_TOKEN,
        "Accept": "application/vnd.api+json; charset=UTF-8",
    },
    timeout: 20000,
});

const paramsSerializer = { serialize: (p: any) => new URLSearchParams(p).toString() };

/** Получить позиции заказа (orderentries) с пагинацией */
async function fetchOrderEntries(orderId: string) {
    const PAGE_SIZE = 100;
    let page = 0;
    const out: any[] = [];

    while (true) {
        const params: Record<string, any> = {
            "page[number]": page,
            "page[size]": PAGE_SIZE,
        };

        await sleep(SLEEP_MS);
        const { data } = await kaspiApi.get(`/orders/${orderId}/entries`, { params, paramsSerializer });

        const entries: any[] = data?.data ?? data?.content ?? [];
        out.push(...entries);

        const hasNextLink = Boolean(data?.links?.next) || Boolean(data?.links?.pagination?.next);
        if (entries.length < PAGE_SIZE || !hasNextLink) break;

        page += 1;
    }

    return out;
}

/** Собираем все заказы за октябрь указанного года (по умолчанию — текущий) с позициями */
export async function fetchAllOrders(year = new Date().getFullYear()) {
    const now = Date.now();
    const HOUR = 60 * 60 * 1000;

    const start: number = now - HOUR; // час назад
    const end: number = now;          // текущее время

    const MAX_WINDOW: number = 14 * 24 * 60 * 60 * 1000; // можно оставить, не влияет
    const PAGE_SIZE: number = 100;
    const all: any[] = [];

    let winFrom = start;
    while (winFrom <= end) {
        const winTo = Math.min(winFrom + MAX_WINDOW - 1, end);

        let page = 0;
        while (true) {
            const params: Record<string, any> = {
                "page[number]": page,
                "page[size]": PAGE_SIZE,
                "filter[orders][creationDate][$ge]": winFrom,
                "filter[orders][creationDate][$le]": winTo,
                // можно фильтровать по статусу:
                // "filter[orders][state]": "NEW" | "DELIVERY" | "KASPI_DELIVERY" | "PICKUP" | "SIGN_REQUIRED" | "ARCHIVE"
            };

            await sleep(SLEEP_MS);
            const { data } = await kaspiApi.get("/orders", { params, paramsSerializer });

            const items: any[] = data?.data ?? data?.content ?? [];
            for (const item of items) {
                // Нормализуем заказ
                // 1) Тянем позиции заказа
                const entries = await fetchOrderEntries(item.id);
                const productsOrder = entries.map((entry: any) => {
                    return {
                        prId: entry.id,              // id позиции из Kaspi
                        type: entry.type,                    // кол-во
                        ...entry.attributes,
                        product: {
                            id: entry.relationships.product.data.id,
                            type: entry.relationships.product.data.type,
                            link: entry.relationships.product.links.related
                        },
                        deliveryPointOfService: {
                            id: entry.relationships.deliveryPointOfService.data.id,
                            type: entry.relationships.deliveryPointOfService.data.type,
                            link: entry.relationships.deliveryPointOfService.links.related
                        }
                    }
                });
                const orderDoc = {
                    ...item,
                    ...item.attributes,   // как у тебя было
                    objects: productsOrder
                };

                //
                // 3) Пишем заказ с objects в Mongo
                await Order.updateOne(
                    { kmId: item.id },
                    { $set: { ...orderDoc } },
                    { upsert: true }
                );

                all.push(orderDoc);
                // Маленькая пауза между обработкой заказов (дополнительная защита)
                await sleep(SLEEP_MS);
            }

            const hasNextLink =
                Boolean(data?.links?.next) || Boolean(data?.links?.pagination?.next);

            if (items.length < PAGE_SIZE || !hasNextLink) break;
            page += 1;
        }

        winFrom = winTo + 1; // следующее окно
    }

    console.log(`✅ Собрано заказов за октябрь ${year}:`, all.length);
    return all;
}

async function runJob() {
    try {
        console.log("🚀 Kaspi worker started:", new Date().toLocaleString());

        // убедимся, что Mongo подключен
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(Env.MONGODB_URI);
            console.log("✅ MongoDB connected");
        }

        await fetchAllOrders().then(() => console.log('✅ Все Загруженно!')) // <-- твоя функция, которая всё делает
        console.log("✅ Kaspi worker finished:", new Date().toLocaleString());
    } catch (err) {
        console.error("⛔ Worker error:", err);
    }
}

cron.schedule('* * * * *' , runJob, {timezone: "Asia/Almaty",}) ;

// --- единичный запуск для проверки ---
// mongoose
//     .connect(Env.MONGODB_URI)
//     .then(() => {
//         console.log("✅ MongoDB connected");
//         fetchAllOrders().then(list => console.log('✅ Все Загруженно!'));
//     })
//     .catch((err) => {
//         console.error("MongoDB connection error:", err);
//         process.exit(1);
//     });
