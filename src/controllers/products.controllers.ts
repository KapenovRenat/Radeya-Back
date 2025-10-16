// src/controllers/product.controller.ts
import { Request, Response } from "express";
import {Product} from "@models/mysklad/Product";

export async function listProducts(req: Request, res: Response) {
    try {
        const page  = Math.max(1, Number(req.body.page) || 1);
        const limit = Math.min(100, Number(req.body.limit) || 20);

        console.log({
            page,
            limit,
        })

        const [items, total] = await Promise.all([
            Product.find()
                .sort({ updatedAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            Product.countDocuments(),
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