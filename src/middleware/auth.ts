import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Env } from "@config/env";

export interface JwtPayload {
    id: string;
    role: "user" | "admin" | "manager";
    email: string;
}

const COOKIE_NAME = Env.JWT_COOKIE_NAME || "access_token";

export const auth = (req: Request, res: Response, next: NextFunction) => {
    // 1) токен из cookie (основной путь)
    const cookieToken = req.cookies?.[COOKIE_NAME];

    // 2) или из Authorization: Bearer <token> (запасной путь)
    const header = req.headers.authorization;
    const bearer = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

    const token = cookieToken;

    if (!token) {
        // временно можно логировать для дебага:
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const payload = jwt.verify(token, Env.JWT_SECRET) as any;

        (req as any).user = payload;
        next();
    } catch (e) {
        // console.error("verify error:", e);
        return res.status(401).json({ message: "Invalid token" });
    }
};

export const requireRole = (role: "user" | "admin" | "manager") => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user as JwtPayload | undefined;
        if (!user) return res.status(401).json({ message: "Unauthorized" });
        if (user.role !== role) return res.status(403).json({ message: "Forbidden" });
        next();
    };
};

export interface AuthRequest extends Request {
    user?: any;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const token = req.cookies?.access_token;

        if (!token) {
            return res.status(401).json({ message: "Нет токена. Авторизация требуется." });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!);
        req.user = decoded;

        next(); // пропускаем дальше
    } catch (err) {
        return res.status(401).json({ message: "Недействительный или просроченный токен" });
    }
}
