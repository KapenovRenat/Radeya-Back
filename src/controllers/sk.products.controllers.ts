// src/controllers/product.controller.ts
import { Request, Response } from "express";
import {SkladProduct} from "@models/mysklad/SkladProduct";

export async function listProducts(req: Request, res: Response) {
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
            SkladProduct.find(filter)
                .sort({ updatedAt: -1, _id: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            SkladProduct.countDocuments(filter),
        ]);

        res.json({
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
            items,
        });
    } catch (err) {
        console.error("❌ Ошибка получения продуктов:", err);
        res.status(500).json({ message: "Ошибка сервера" });
    }
}