import { Request, Response } from "express";
import {Accounting} from "@models/Accounting";
import monthRangeAlmaty from "@utils/filterDate";
import {Order} from "@models/orders/Order";

export async function createAccounting(req: Request, res: Response) {
    try {
        const { date, type } = req.body;

        await Accounting.updateOne(
            { name: date },
            { $set:  { type} },
            { upsert: true }
        );

        res.status(200).json({message: 'Таблица Учета Создана!'})
    } catch (err) {
        console.error("❌ Ошибка Создания Таблицы Учета:", err);
        res.status(500).json({ message: "Ошибка сервера" });
    }
}

export async function getAccounting(req: Request, res: Response) {
    try {
        const page  = Math.max(1, Number(req.body.page) || 1);
        const limit = Math.min(100, Number(req.body.limit) || 20);

        const [acc, total] = await Promise.all([
            Accounting.find()
                .sort({ updatedAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            Accounting.countDocuments(),
        ]);

        let items: any = [];
        for (const accItem of acc) {
            const d = new Date(accItem.name);
            const year = d.getFullYear();
            const month = d.getMonth() + 1;
            const { startTimestamp, endTimestamp } = monthRangeAlmaty(year, month);
            const rows = await Order.find({
                creationDate: { $gte: startTimestamp, $lt: endTimestamp },
            }).lean();
            items.push({
                ...accItem,
                countOrders: rows.length || null,
                sum: null,
                dates: rows
            })
        }

        res.json({
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
            items,
        });
    } catch (e) {
        console.error("❌ Ошибка получения таблиц заказа:", e);
        res.status(500).json({ message: "Ошибка сервера" });
    }
}