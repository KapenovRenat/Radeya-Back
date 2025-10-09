// src/index.ts
import "express-async-errors";
import express, { Request, Response } from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { Env } from "./config/env.js"; // ← вот отсюда берём env

const app = express();

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());

// test route
app.get("/health", (_req: Request, res: Response) => {
    res.json({ ok: true, env: Env.NODE_ENV });
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