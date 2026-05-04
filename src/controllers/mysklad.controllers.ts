import { Request, Response } from "express";
import axios from "axios";
import { Env } from "@config/env";
import { Supplier } from "@models/mysklad/Supplier";

const BASE = Env.MOYSKLAD_BASE || "https://api.moysklad.ru/api/remap/1.2";
const basic = Buffer.from(`${Env.MOYSKLAD_LOGIN}:${Env.MOYSKLAD_PASSWORD}`).toString("base64");



const ms = axios.create({
    baseURL: BASE,
    timeout: 30_000,
    headers: {
        Accept: "application/json;charset=utf-8",
        "Content-Type": "application/json;charset=utf-8",
        Authorization: `Basic ${basic}`,
        "Accept-Encoding": "gzip"
    },
});

function extractId(href: string): string | null {
    if (!href) return null;
    const clean = href.split("?")[0]; // убираем query params
    const parts = clean.split("/");
    return parts[parts.length - 1] ?? null;
}

function mapOrder(row: any) {
    return {
        id: row.id,
        name: row.name ?? null,
        externalCode: row.externalCode ?? null,
        moment: row.moment ?? null,
        created: row.created ?? null,
        updated: row.updated ?? null,
        applicable: row.applicable ?? false,
        printed: row.printed ?? false,
        published: row.published ?? false,

        sum: row.sum != null ? row.sum / 100 : null,
        payedSum: row.payedSum != null ? row.payedSum / 100 : null,
        shippedSum: row.shippedSum != null ? row.shippedSum / 100 : null,
        invoicedSum: row.invoicedSum != null ? row.invoicedSum / 100 : null,
        waitSum: row.waitSum != null ? row.waitSum / 100 : null,
        vatSum: row.vatSum != null ? row.vatSum / 100 : null,
        vatEnabled: row.vatEnabled ?? false,
        vatIncluded: row.vatIncluded ?? false,

        agent: {
            id: extractId(row.agent?.meta?.href ?? ""),
            href: row.agent?.meta?.href ?? null,
        },
        store: {
            id: extractId(row.store?.meta?.href ?? ""),
            href: row.store?.meta?.href ?? null,
        },
        state: {
            id: extractId(row.state?.meta?.href ?? ""),
            href: row.state?.meta?.href ?? null,
        },

        positionsCount: row.positions?.meta?.size ?? 0,
        suppliesCount: row.supplies?.length ?? 0,
        customerOrdersCount: row.customerOrders?.length ?? 0,
    };
}

export async function getPurchaseOrders(req: Request, res: Response) {
    const { dateFrom, dateTo, supplierId } = req.query as Record<string, string>;

    const filters: string[] = [];

    if (dateFrom) filters.push(`moment>=${dateFrom}`);
    if (dateTo) filters.push(`moment<=${dateTo}`);

    // МойСклад требует полный href для фильтра по агенту
    if (supplierId) {
        filters.push(`agent=${BASE}/entity/counterparty/${supplierId}`);
    }

    const params: Record<string, any> = {
        limit: 100,
        offset: 0,
        order: "moment,desc",
    };
    if (filters.length) params.filter = filters.join(";");

    // Забираем все страницы если записей > 100
    const allRows: any[] = [];
    let total = 0;

    while (true) {
        const { data } = await ms.get("/entity/purchaseorder", { params });
        total = data.meta?.size ?? 0;
        allRows.push(...(data.rows ?? []));

        if (allRows.length >= total || !data.meta?.nextHref) break;
        params.offset += 100;
    }

    res.json({
        total,
        count: allRows.length,
        items: allRows.map(mapOrder),
    });
}

export async function getSalesHistory(req: Request, res: Response) {
    const { dateFrom, dateTo, supplierId } = req.query as Record<string, string>;

    const momentFrom = dateFrom ?? "2026-01-01 00:00:00";
    const momentTo   = dateTo   ?? "2026-05-04 23:59:59";

    // Фильтр по поставщику
    const supplierFilter = supplierId
        ? `supplier=${BASE}/entity/counterparty/${supplierId}`
        : undefined;

    // Параллельно забираем оба отчёта постранично
    async function fetchAll(url: string, params: Record<string, any>): Promise<any[]> {
        const all: any[] = [];
        let offset = 0;
        while (true) {
            const { data } = await ms.get(url, { params: { ...params, limit: 100, offset } });
            all.push(...(data.rows ?? []));
            const size: number = data.meta?.size ?? 0;
            offset += 100;
            if (offset >= size) break;
        }
        return all;
    }

    const profitParams: Record<string, any> = { momentFrom, momentTo };
    if (supplierFilter) profitParams.filter = supplierFilter;

    const stockParams: Record<string, any> = { stockMode: "all" };
    if (supplierFilter) stockParams.filter = supplierFilter;

    // Ассортимент — все товары/варианты каталога (базовый список)
    const assortmentParams: Record<string, any> = { type: "product,variant" };
    if (supplierFilter) assortmentParams.filter = supplierFilter;

    const [profitRows, stockRows, assortmentRows] = await Promise.all([
        fetchAll("/report/profit/byproduct", profitParams),
        fetchAll("/report/stock/all", stockParams),
        fetchAll("/entity/assortment", assortmentParams),
    ]);

    console.log(`[salesHistory] profit=${profitRows.length} stock=${stockRows.length} assortment=${assortmentRows.length}`);

    // Индекс прибыли по productId
    const profitMap = new Map<string, any>();
    for (const r of profitRows) {
        const id = extractId(r.assortment?.meta?.href ?? "");
        if (id) profitMap.set(id, r);
    }

    // Индекс остатков по productId
    const stockMap = new Map<string, any>();
    for (const s of stockRows) {
        const id = extractId(s.meta?.href ?? "");
        if (id) stockMap.set(id, s);
    }

    // Дней в периоде
    const days = Math.max(1, Math.round(
        (new Date(momentTo).getTime() - new Date(momentFrom).getTime()) / 86_400_000
    ));

    // База — полный ассортимент, profit и stock накладываем поверх
    const items = assortmentRows.map((a: any) => {
        const productId = a.id as string;
        const s      = stockMap.get(productId)  ?? null;
        const profit = profitMap.get(productId) ?? null;

        const sellQty   = profit?.sellQuantity ?? 0;
        const sellSum   = (profit?.sellSum     ?? 0) / 100;
        const costSum   = (profit?.sellCostSum ?? 0) / 100;
        const profitVal = (profit?.profit      ?? 0) / 100;
        const profitPct = +((profit?.margin    ?? 0) * 100).toFixed(2);

        const salesPerDay = +(sellQty / days).toFixed(2);

        // Остатки (из stock report, если есть)
        const stockQty  = s?.stock     ?? 0;
        const reserve   = s?.reserve   ?? 0;
        const inTransit = s?.inTransit ?? 0;
        const available = s?.quantity  ?? 0;

        return {
            productId,
            name:     s?.name ?? profit?.assortment?.name ?? null,
            code:     s?.code ?? profit?.assortment?.code ?? null,
            imageUrl: s?.image?.miniature?.href ?? profit?.assortment?.image?.miniature?.href ?? null,
            sellQty,
            sellSum,
            costSum,
            profit: profitVal,
            profitPct,
            salesPerDay,
            stockQty,
            reserve,
            inTransit,
            available,
        };
    }).sort((a: any, b: any) => b.sellQty - a.sellQty);

    res.json({ total: items.length, items });
}

export async function getSuppliers(req: Request, res: Response) {
    const suppliers = await Supplier.find().sort({ name: 1 }).lean();
    res.json({ total: suppliers.length, items: suppliers });
}

export async function syncSuppliers(req: Request, res: Response) {
    const { data } = await ms.get("/entity/counterparty", {
        // params: { limit: 100 },
    });

    const rows = data.rows ?? [];

    await Promise.all(
        rows.map((row: any) =>
            Supplier.updateOne(
                { msId: row.id },
                {
                    $set: {
                        msId: row.id,
                        name: row.name ?? "",
                        externalCode: row.externalCode ?? null,
                        companyType: row.companyType ?? null,
                        phone: row.phone ?? null,
                        email: row.email ?? null,
                        actualAddress: row.actualAddress ?? null,
                        tags: row.tags ?? [],
                        archived: row.archived ?? false,
                        salesAmount: row.salesAmount ?? 0,
                        createdAtMs: row.created ?? null,
                        updatedAtMs: row.updated ?? null,
                    },
                },
                { upsert: true }
            )
        )
    );

    const suppliers = await Supplier.find().sort({ name: 1 }).lean();
    res.json({ total: suppliers.length, items: suppliers });
}
