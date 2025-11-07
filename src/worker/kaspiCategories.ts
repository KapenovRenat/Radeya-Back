import axios from "axios";
import { Env } from "@config/env";
import mongoose from "mongoose";
import {CodeCategory} from "@models/product/features/CodeCategory";

const kaspiApiDef = axios.create({
    baseURL: "https://kaspi.kz/shop/api",
    timeout: 20000,
    headers: {
        Accept: "application/json",
        "X-Auth-Token": Env.KASPI_API_TOKEN,
    },
});

// Получения кодов Категории
export async function kaspiGetCodeCategory() {
    try {
        const resCategories = await kaspiApiDef.get('/products/classification/categories');

        const ops = resCategories.data.map((p: any) => ({
            updateOne: {
                filter: { code: p.code },   // по какому полю ищем
                update: { $set: { ...p } }, // что обновляем
                upsert: true,               // если нет — создать
            },
        }));

        await CodeCategory.bulkWrite(ops);
    } catch (err) {
        console.error("❌ Ошибка получения всех характеристик:", err);
        // res.status(500).json({ message: "Ошибка сервера" });
    }
}

// --- единичный запуск для проверки ---
mongoose
    .connect(Env.MONGODB_URI)
    .then(async () => {
        console.log("✅ MongoDB connected");

        await kaspiGetCodeCategory();
        console.log("✅ Все категории загружены!");

        await mongoose.disconnect();
        console.log("🔒 MongoDB disconnected");

        process.exit(0);
    })
    .catch((err) => {
        console.error("MongoDB connection error:", err);
        process.exit(1);
    });