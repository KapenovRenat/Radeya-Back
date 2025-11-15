import { Request, Response } from "express";
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import {IProduct} from "@models/product/Product";
import { Env } from "@config/env";
import {Product} from "@models/product/Product";
import {Order} from "@models/orders/Order";
import {CodeCategory} from "@models/product/features/CodeCategory";
import {fixPrefix, uploadManyFilesToYandex} from "@utils/upload-yandex";
import {existsInDb, getRandomDigits, getRandomSecondLetter} from "@controllers/randomaze-article.controllers";
import firstLetterToEng from "@utils/firstLetterToEng";

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

export const kaspiApi = axios.create({
    baseURL: Env.KASPI_API_URL, // например: https://kaspi.kz/shop/api/v2
    headers: {
        "X-Auth-Token": Env.KASPI_API_TOKEN,
        "Accept": "application/vnd.api+json; charset=UTF-8",
    },
    timeout: 20000,
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

            // 🔍 Проверяем, есть ли уже товар в базе и у него previewImgUrl
            const existing = await Product.findOne(
                { article },
                { previewImgUrl: 1, _id: 0 },
            ).lean();

            let previewImgUrl: string | undefined = existing?.previewImgUrl;

            // ⚙️ Если ссылки ещё нет — делаем запрос к МойСклад
            if (!previewImgUrl) {
                try {
                    previewImgUrl = await getMsPermanentImageUrlByArticle(article);
                    await new Promise((res) => setTimeout(res, 500)); // пауза между запросами
                } catch (e) {
                    console.warn(`❌ Не удалось получить картинку из МС для артикула ${article}:`, e);
                }
            } else {
                console.log(`⏩ Пропускаем ${article} — ссылка уже есть`);
            }

            // 👉 тут получаем публичную ссылку с МойСклад
            // let previewImgUrl: string | undefined;
            // try {
            //     previewImgUrl = await getMsPermanentImageUrlByArticle(article);
            // } catch (e) {
            //     console.warn(`Не удалось получить картинку из МС для артикула ${article}:`, e);
            // }

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

        res.json({
            message: `✅Список товар Обновлен с Каспи! Кол-во ${products.length}`
        });
    } catch (err) {
        console.error("❌ Ошибка чтения XML Price Kaspi:", err);
        // res.status(500).json({ message: "❌ Ошибка чтения XML Price Kaspi" });
    }
}

export async function listProductKaspi(req: Request, res: Response) {
    try {
        const page  = Math.max(1, Number(req.body.page) || 1);
        const limit = Math.min(100, Number(req.body.limit) || 20);
        const search = String(req.body.search || "").trim();

        const filter: any = {};

        // если передана строка поиска — фильтруем по имени
        if (search) {
            // filter.name = { $regex: search, $options: "i" }; // регистронезависимый поиск
            filter.$or = [
                { name: { $regex: search, $options: "i" } },
                { article: { $regex: search, $options: "i" } },
            ];
        }

        const [items, total] = await Promise.all([
            Product.find(filter)
                .sort({ updatedAt: -1, _id: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            Product.countDocuments(filter),
        ]);

        res.json({
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
            items,
        });
    } catch (err) {
        console.error("❌ Ошибка получения продуктов Каспи:", err);
        res.status(500).json({ message: "Ошибка сервера" });
    }
}


// получаем поля для заполнения

const kaspiApiDef = axios.create({
    baseURL: "https://kaspi.kz/shop/api",
    timeout: 20000,
    headers: {
        Accept: "application/json",
        "X-Auth-Token": Env.KASPI_API_TOKEN
    },
});


export async function getCategoriesProductKaspi(req: Request, res: Response) {
    try {
        const page  = Math.max(1, Number(req.body.page) || 1);
        const limit = Math.min(100, Number(req.body.limit) || 20);
        const search = String(req.body.search || "").trim();

        const filter: any = {};

        // если передана строка поиска — фильтруем по имени
        if (search) {
            // filter.name = { $regex: search, $options: "i" }; // регистронезависимый поиск
            filter.$or = [
                { title: { $regex: search, $options: "i" } }
            ];
        }

        const [items, total] = await Promise.all([
            CodeCategory.find(filter)
                .sort({ updatedAt: -1, _id: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            CodeCategory.countDocuments(filter),
        ]);

        res.json({
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
            items,
        });
    } catch (err) {
        console.error("❌ Ошибка получения категорий Каспи:", err);
        res.status(500).json({ message: "Ошибка сервера" });
    }
}

export async function getFieldCategoryKaspiProduct(req: Request, res: Response) {
    try {
        const code  = req.body.categoryCode;
        const resAttributes = await kaspiApiDef.get('/products/classification/attributes', {
            params: { c: code }, // <-- передаём код категории
        });
        const attributes = resAttributes.data;
        const fields = [];

        if (attributes && attributes.length > 0) {
            // console.log(attributes);
            for (const attr of attributes) {
                try {
                    const resAttributesValues = await kaspiApiDef.get('/products/classification/attribute/values', {
                        params: { c: code, a: attr.code },
                    });

                    const newAttr = {
                        ...attr,
                        values: resAttributesValues.data
                    }

                    fields.push(newAttr);
                    await new Promise((res) => setTimeout(res, 500));
                } catch (err) {
                    console.warn(`❌ Ошибка получения!`, err);
                }
            }
        }
        res.json({
            fields
        });

    } catch (err) {
        console.error("❌ Формирования Полей для товара:", err);
        res.status(500).json({ message: "Ошибка сервера" });
    }
}

const fieldExclusion = ['title', 'description', 'color', 'korobs'];

export async function createKaspiProduct(req: Request, res: Response) {
    try {
        const { categoryCode } = req.body;
        const categoryAttr = JSON.parse(req.body.categoryAttr);
        // получаем все цвета и их файлы
        const colorsJson = JSON.parse(req.body.colors || "[]") as {
            idx: number;
            code: string;
        }[];

        const categoryAttrWithoutColor =  categoryAttr.filter((x: any) => {
            if (x.code.split('*').pop()?.trim() !== 'Color') return x;
        });

        const title = categoryAttr.find((x: any) => x.code === 'title');
        const files = (req as any).files as Express.Multer.File[] || [];

        // склеиваем цвета с их файлами
        const colors = colorsJson.map((color: any, index: number) => {
            const filesForColor = files.filter(
                (f) => f.fieldname === `images_${index}`
            );

            return {
                code: color.code,
                files: filesForColor,
            };
        });

        const basePrefix = `kaspi/${fixPrefix(categoryCode)}/${Date.now()}`;

        let colorsLinks = [];

        for (const color of colors) {
            if (color.files.length === 0) {
                colorsLinks.push({
                    code: color.code,
                    kaspiImages: []
                });
                continue;
            }

            const prefix = `${basePrefix.trim()}/${title ? title.selected : 'noname'}/color-${color.code}`.trim();
            const urls: any = await uploadManyFilesToYandex(color.files, prefix);

            colorsLinks.push({
                code: color.code,
                kaspiImages: urls.map((url: any) => {
                    return {
                        url
                    }
                })
            });
        }

        const firstLetter = firstLetterToEng(title.selected[0].toUpperCase());
        const secondLetter = getRandomSecondLetter(firstLetter);
        const prefix = `${firstLetter}${secondLetter}`;

        const result: string[] = [];

        while (result.length < colorsLinks.length) {
            const digits = getRandomDigits();
            const candidate = `${prefix}${digits}`;

            // проверка дубликатов в текущей генерации
            if (result.includes(candidate)) continue;

            // проверка в базе по regex (например, MB329 и MB329-1)
            const exists = await existsInDb(candidate);
            if (!exists) {
                let categoryKM: any = {
                    sku: candidate,
                    brand: 'RADEYA',
                    category: categoryCode,
                    attributes: []
                }
                let otherAttr = [];

                for (const attr of categoryAttrWithoutColor) {
                    if (attr.code === 'title') {
                        categoryKM = {
                            title: attr.selected,
                            ...categoryKM
                        }
                    }

                    if (attr.code === 'description') {
                        categoryKM = {
                            description: attr.selected,
                            ...categoryKM
                        }
                    }


                    if (attr.multiValued) {
                        otherAttr.push({code: attr.code, value: attr.selected.map((item: any) => item.code)});
                    } else {
                        otherAttr.push({code: attr.code, value: typeof attr.selected === 'object' ? [attr.selected.code] : attr.selected});
                    }
                }

                categoryKM = {
                    ...categoryKM,
                    attributes: otherAttr.filter((x: any) => !fieldExclusion.includes(x.code))
                }
                result.push(categoryKM);
            } else {
                // если уже есть в базе — перегенерим цифры, но оставляем тот же prefix
                continue;
            }
        }

        const mappingResult = result.map((item: any, index: number) => {
            const colorCode = categoryAttr.find((x: any) => {
                if (x.code.split('*').pop()?.trim() === 'Color') return x;
            })
            const color = colorsLinks[index];
            let attributes = item.attributes;

            return {
                ...item,
                attributes: [...attributes, {code: colorCode.code, value: color.code}],
                images: color.kaspiImages
            }
        });

        const productSaveDB = mappingResult.map((p) => ({
            updateOne: {
                filter: { article: p.sku },
                update: {
                    $set: {
                        article: p.sku,
                        name: p.title,
                        isActiveKaspi: 'no',
                        previewImgUrl: p.images && p.images.length > 0 ? p.images[0].url : '',
                        imagesKM: p.images,
                        ...p // 👈 пишем картинку из МС
                    },
                },
                upsert: true,
            },
        }));
        await Product.bulkWrite(productSaveDB);
        const kaspiResponse = await kaspiApiDef.post('/products/import', JSON.stringify(mappingResult), {headers: {"Content-Type": "text/plain; charset=utf-8"}});
        const productUpdate = mappingResult.map((p) => ({
            updateOne: {
                filter: { article: p.sku },
                update: {
                    $set: {
                        uniqueCode: kaspiResponse.data.code,
                        status: kaspiResponse.data.status
                    },
                },
                upsert: true,
            },
        }));
        await Product.bulkWrite(productUpdate);

        if (kaspiResponse.data.status === 'UPLOADED') {
            const kaspiCheckProduct = await kaspiApiDef.get('/products/import/result', {
                params: { i: kaspiResponse.data.code }, // <-- передаём код категории
            });

            return res.status(200).json({
                message: kaspiResponse.data.status,
                data: kaspiCheckProduct.data
            });
        } else {
            res.status(200).json({
                message: kaspiResponse.data
            });
        }

    } catch (e) {
        console.error("❌ Не удалось создать товар:", e);
        res.status(500).json({ message: "Ошибка сервера" });
    }
}
