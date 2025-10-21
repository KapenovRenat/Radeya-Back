import axios from "axios";
import { Env } from "@config/env";

// за последние 24 часа
// const to: number = Date.now(); // текущее время
// const from: number = to - 24 * 60 * 60 * 1000; // 24 часа в миллисекундах

const pretty = (obj: any) => JSON.stringify(obj, null, 2);

export const kaspiApi = axios.create({
    baseURL: Env.KASPI_API_URL,
    headers: {
        "X-Auth-Token": Env.KASPI_API_TOKEN,
        "Accept": "application/vnd.api+json; charset=UTF-8",
        timeout: 20000,
    },
});

// const params = {
//     // 'filter[orders][state]': 'NEW', // (опционально) статус заказа: NEW, PICKUP, DELIVERY и т.д.
//     'page[number]': 0,
//     'page[size]': 100, // максимум 100 заказов на страницу
//     'filter[orders][creationDate][$ge]': from,
//     'filter[orders][creationDate][$le]': to,
// };
//
// export async function fetchKaspiOrders() {
//     try {
//         const response = await kaspiApi.get("/orders", {params});
//
//
//         console.log("✅ Заказы Kaspi:", pretty(response.data));
//     } catch (error: any) {
//         console.error("❌ Ошибка при получении заказов Kaspi:", error.response?.data || error.message);
//     }
// }
//
// fetchKaspiOrders()

const paramsSerializer = { serialize: (p: any) => new URLSearchParams(p).toString() };

/** Собираем все заказы за октябрь указанного года (по умолчанию текущего) */
export async function fetchAllOrdersForOctober(year = new Date().getFullYear()) {
    // Казахстан (UTC+5). Берём [01 Oct 00:00:00 .. 01 Nov 00:00:00) - 1ms
    const start = new Date(`${year}-10-01T00:00:00+05:00`).getTime();
    const end   = new Date(`${year}-11-01T00:00:00+05:00`).getTime() - 1;

    const DAY = 24 * 60 * 60 * 1000;
    const MAX_WINDOW = 14 * DAY;               // лимит Kaspi
    const PAGE_SIZE = 100;                      // max по API
    const all: any[] = [];

    let winFrom = start;
    while (winFrom <= end) {
        const winTo = Math.min(winFrom + MAX_WINDOW - 1, end);

        let page = 0;
        // проходим страницы в текущем окне
        while (true) {
            const params: Record<string, any> = {
                'page[number]': page,
                'page[size]': PAGE_SIZE,
                'filter[orders][creationDate][$ge]': winFrom,
                'filter[orders][creationDate][$le]': winTo,
                // при желании можно фильтровать по статусу:
                // 'filter[orders][state]': 'NEW' | 'DELIVERY' | 'KASPI_DELIVERY' | 'PICKUP' | 'SIGN_REQUIRED' | 'ARCHIVE'
            };

            const { data } = await kaspiApi.get('/orders', { params, paramsSerializer });

            // у разных версий API массив может быть в data или content
            const items: any[] = data?.data ?? data?.content ?? [];
            all.push(...items);

            // эвристики окончания пагинации:
            const hasNextLink =
                Boolean(data?.links?.next) || Boolean(data?.links?.pagination?.next);

            // если пришла неполная страница — дальше нет
            if (items.length < PAGE_SIZE || !hasNextLink) break;

            page += 1;
        }

        winFrom = winTo + 1; // следующее окно
    }

    console.log(`✅ Собрано заказов за октябрь ${year}:`, all.length);
    return all;
}

// единичный запуск для проверки:
fetchAllOrdersForOctober().then(list => console.dir(list.slice(0,3), {depth: null}));
