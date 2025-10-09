// src/config/env.ts
import dotenv from "dotenv";

dotenv.config(); // загружает .env → process.env

export const Env = {
    PORT: process.env.PORT || "4000",
    MONGODB_URI: process.env.MONGODB_URI || "",
    JWT_SECRET: process.env.JWT_SECRET || "",
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
    NODE_ENV: process.env.NODE_ENV || "development",
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