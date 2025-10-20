import axios from "axios";
import { Env } from "@config/env";

// с 1 октября по сегодняшний день
const from = new Date('2025-10-15T00:00:00+05:00').getTime(); // начало 1 октября
const to = Date.now(); // текущее время

const pretty = (obj: any) => JSON.stringify(obj, null, 2);

export const kaspiApi = axios.create({
    baseURL: Env.KASPI_API_URL,
    headers: {
        "X-Auth-Token": Env.KASPI_API_TOKEN,
        "Accept": "application/vnd.api+json; charset=UTF-8",
        timeout: 20000,
    },
});

const params = {
    // 'filter[orders][state]': 'NEW', // (опционально) статус заказа: NEW, PICKUP, DELIVERY и т.д.
    'page[number]': 0,
    'page[size]': 1, // максимум 100 заказов на страницу
    'filter[orders][creationDate][$ge]': from,
    'filter[orders][creationDate][$le]': to,
};

export async function fetchKaspiOrders() {
    try {
        const response = await kaspiApi.get("/orders", {params});


        console.log("✅ Заказы Kaspi:", pretty(response.data));
    } catch (error: any) {
        console.error("❌ Ошибка при получении заказов Kaspi:", error.response?.data || error.message);
    }
}

fetchKaspiOrders()