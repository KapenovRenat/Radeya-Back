// src/config/env.ts
import dotenv from "dotenv";
import * as process from "node:process";

dotenv.config(); // загружает .env → process.env

export const Env = {
    PORT: process.env.PORT || "4000",
    MONGODB_URI: process.env.MONGODB_URI || "",
    JWT_SECRET: process.env.JWT_SECRET || "kapa",
    JWT_EXPIRES_IN: Number(process.env.JWT_EXPIRES_IN ?? 86400), // 👈 вот это ключевой момент
    NODE_ENV: process.env.NODE_ENV || "development",
    FRONTEND_URL: process.env.FRONTEND_URL,
    JWT_COOKIE_NAME: process.env.JWT_COOKIE_NAME,
    MOYSKLAD_BASE: process.env.MOYSKLAD_BASE,
    MOYSKLAD_LOGIN: process.env.MOYSKLAD_LOGIN,
    MOYSKLAD_PASSWORD: process.env.MOYSKLAD_PASSWORD,
    KASPI_API_TOKEN:process.env.KASPI_API_TOKEN,
    KASPI_API_URL:process.env.KASPI_API_URL,
    KASPI_XML_KASPI_PRICE_URL: process.env.KASPI_XML_KASPI_PRICE_URL || ""
};

// Проверим важные переменные при старте
if (!Env.MONGODB_URI) {
    console.error("❌ MONGODB_URI is missing in .env");
    process.exit(1);
}

if (!Env.JWT_SECRET) {
    console.error("❌ JWT_SECRET is missing in .env");
    process.exit(1);
}