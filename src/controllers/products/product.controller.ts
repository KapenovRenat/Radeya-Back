import { Request, Response } from "express";
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import {IProduct} from "@models/product/Product";
import { Env } from "@config/env";
import {Product} from "@models/product/Product";

const KASPI_XML_URL = Env.KASPI_XML_KASPI_PRICE_URL as string;
const BASE = Env.MOYSKLAD_BASE || "https://api.moysklad.ru/api/remap/1.2";
const LOGIN = Env.MOYSKLAD_LOGIN;
const PASSWORD = Env.MOYSKLAD_PASSWORD;

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

/**
 * Возвращает публичную ссылку на миниатюру товара из МойСклад по артикулу.
 * Если картинки нет — вернёт undefined.
 */
export async function getMsPermanentImageUrlByArticle(
    article: string,
): Promise<string | undefined> {
    if (!article) return undefined;
    // console.log(article)

    // 1) ищем товар по артикулу
    const productRes = await ms.get('/entity/product', {
        params: {
            filter: `code=${article}`,
            limit: 1,
        },
    });

    const product = productRes.data?.rows?.[0];
    if (!product || !product.meta?.href) return undefined;

    // console.log(product)

    const imagesHref: string = `${product.meta.href}/images`;

    // 2) берём картинки с полем downloadPermanentHref
    const imagesRes = await ms.get(imagesHref, {
        params: {
            fields: 'downloadPermanentHref',
            limit: 1,
        },
    });

    const imageRow = imagesRes.data?.rows?.[0];

    if (!imageRow?.meta?.downloadPermanentHref) return undefined;

    // 👉 это уже постоянная публичная ссылка
    return imageRow.meta.downloadPermanentHref as string;
}

export async function readXmlPriceKaspi(req: Request, res: Response) {
    try {
        if (!KASPI_XML_URL) {
            throw new Error('Не задан env KASPI_XML_KASPI_PRICE_URL');
        }

        // 1. тянем XML
        const { data: xml } = await axios.get<string>(KASPI_XML_URL, {
            responseType: 'text',
        });

        // 2. парсим
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
        });

        const parsed = parser.parse(xml);
        const offersRaw = parsed?.kaspi_catalog?.offers?.offer;
        const offers: any[] = Array.isArray(offersRaw) ? offersRaw : offersRaw ? [offersRaw] : [];

        if (!offers.length) {
            throw new Error('В XML не найдено ни одного offer');
        }

        const products: {
            article: string;
            name: string;
            isActiveKaspi?: string;
            storeId?: string;
            storeOrder?: string;
            currentPrice?: number;
            previewImgUrl?: string;
        }[] = [];

        // 3. обходим товары Каспи и для каждого тянем картинку из МойСклад
        for (const offer of offers) {
            const article = String(offer['@_sku'] ?? '').trim();
            const name = String(offer.model ?? '').trim();

            if (!article) continue;

            let currentPrice: number | undefined;
            if (offer.price != null) {
                currentPrice = Number(offer.price);
            } else if (offer.cityprices?.cityprice) {
                const cp = Array.isArray(offer.cityprices.cityprice)
                    ? offer.cityprices.cityprice
                    : [offer.cityprices.cityprice];
                if (cp.length) {
                    const val = cp[0]['#text'] ?? cp[0];
                    currentPrice = Number(val);
                }
            }

            let storeId: string | undefined;
            let isActiveKaspi: string | undefined;
            let storeOrder: string | undefined;

            const avRaw: any = offer.availabilities?.availability;
            const avArr: any[] = Array.isArray(avRaw) ? avRaw : avRaw ? [avRaw] : [];

            if (avArr.length) {
                const first: any = avArr[0];
                storeId = first['@_storeId'] ? String(first['@_storeId']) : undefined;
                isActiveKaspi = first['@_available'] ? String(first['@_available']) : undefined;
                storeOrder = first['@_preOrder'] ? String(first['@_preOrder']) : undefined;
            }

            // 👉 тут получаем публичную ссылку с МойСклад
            let previewImgUrl: string | undefined;
            try {
                previewImgUrl = await getMsPermanentImageUrlByArticle(article);
            } catch (e) {
                console.warn(`Не удалось получить картинку из МС для артикула ${article}:`, e);
            }

            products.push({
                article: article, // у тебя в схеме lowercase: true
                name,
                isActiveKaspi,
                storeId,
                storeOrder,
                currentPrice,
                previewImgUrl,
            });
        }

        // 4. upsert в Product по article
        const ops = products.map((p) => ({
            updateOne: {
                filter: { article: p.article },
                update: {
                    $set: {
                        name: p.name,
                        isActiveKaspi: p.isActiveKaspi,
                        storeId: p.storeId,
                        storeOrder: p.storeOrder,
                        currentPrice: p.currentPrice,
                        previewImgUrl: p.previewImgUrl, // 👈 пишем картинку из МС
                    },
                },
                upsert: true,
            },
        }));

        const result = await Product.bulkWrite(ops);
        // // console.log('Kaspi XML sync done:', {
        // //     totalFromXml: products.length,
        // //     matched: result.matchedCount,
        // //     modified: result.modifiedCount,
        // //     upserted: result.upsertedCount,
        // // });
        //
        // console.log('Всего товаров из XML:', products.length);
        // console.log(products);

        res.json({
            message: `✅Список товар Обновлен с Каспи! Кол-во ${products.length}`
        });
    } catch (err) {
        console.error("❌ Ошибка чтения XML Price Kaspi:", err);
        // res.status(500).json({ message: "❌ Ошибка чтения XML Price Kaspi" });
    }
}