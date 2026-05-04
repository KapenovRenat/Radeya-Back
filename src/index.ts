// src/index.ts
import "express-async-errors";
import express, { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { Env } from "@config/env"; // ← вот отсюда берём env
import authRoutes from "@routers/auth.route";
import productRoute from "@routers/product.route";
import randomazeRoute from "@routers/randomaze-article.route";
import accountingRoute from "@routers/accounting.route";
import myskladRoute from "@routers/mysklad.route";
import {authMiddleware} from "@middleware/auth";

const app = express();

app.use(helmet());
app.use(cors({
    origin: Env.FRONTEND_URL,   // например http://localhost:3000
    credentials: true,          // важное!http://localhost:3000/auth
}));
app.use(morgan("dev"));
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());

// test route
app.get("/", (_req: Request, res: Response) => {
    res.json({ ok: true, env: Env.NODE_ENV });
});

app.use("/auth", authRoutes);
app.use("/products", authMiddleware, productRoute);
app.use("/randomaze-article", authMiddleware, randomazeRoute);
app.use("/", authMiddleware, accountingRoute);
app.use("/mysklad", authMiddleware, myskladRoute);

// Глобальный JSON error handler — всегда возвращает JSON, не HTML
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[Global Error]", err);
    res.status(err.status ?? 500).json({
        error: err.message ?? "Internal Server Error",
    });
});

mongoose
    .connect(Env.MONGODB_URI)
    .then(() => {
        console.log("✅ MongoDB connected");
        app.listen(Number(Env.PORT), () => {
            console.log(`🚀 Server running at http://localhost:${Env.PORT}`);
        });
    })
    .catch((err) => {
        console.error("MongoDB connection error:", err);
        process.exit(1);
    });