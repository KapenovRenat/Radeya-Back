import axios from "axios";

const KASPI_API_URL = "https://kaspi.kz/merchant/api/v2/products";
const KASPI_API_TOKEN = process.env.KASPI_API_TOKEN!; // ⚠️ обязательно добавь в .env

/** Получает все товары из Kaspi API с постраничной подгрузкой */
export async function fetchKaspiProducts() {
    try {
        let page = 0;
        const size = 100;              // максимум 100 на страницу
        const allProducts: any[] = [];

        while (true) {
            const res = await axios.get(KASPI_API_URL, {
                headers: {
                    Authorization: `Bearer ${KASPI_API_TOKEN}`,
                    Accept: "application/json",
                },
                params: { page, size },
            });

            const data = res.data;
            const products = data.content || [];

            console.log(`📦 Страница ${page + 1}/${data.totalPages} → получено ${products.length} товаров`);

            allProducts.push(...products);

            if (page >= data.totalPages - 1) break;
            page++;
        }

        console.log("✅ Всего товаров:", allProducts.length);
        console.log(allProducts.map((p: any) => ({
            sku: p.sku,
            name: p.name,
            price: p.price,
            availability: p.availability
        })));

        return allProducts;
    } catch (err: any) {
        console.error("❌ Ошибка при запросе к Kaspi API:", err.response?.data || err.message);
        throw err;
    }
}

fetchKaspiProducts();
