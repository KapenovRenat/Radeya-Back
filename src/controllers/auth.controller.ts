import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt, { SignOptions, Secret } from "jsonwebtoken";
import { User } from "@models/User";
import { Env } from "@config/env";

const COOKIE_NAME = Env.JWT_COOKIE_NAME || "access_token";

function setAuthCookie(res: Response, token: string) {
    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",         // прод с разными доменами: "none"
        secure: false,           // прод за HTTPS: true
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
}

const signToken = (payload: { id: string; role: "user" | "admin" | "manager"; login: string }) =>
    jwt.sign(payload, Env.JWT_SECRET, { expiresIn: Number(Env.JWT_EXPIRES_IN) });

export const register = async (req: Request, res: Response) => {
    const { login, password, role } = req.body as {
        login: string;
        password: string;
        role?: "user" | "admin" | "manager";
    };

    if (!login || !password) {
        return res.status(400).json({ message: "login and password are required" });
    }

    const existing = await User.findOne({ login });
    if (existing) {
        return res.status(409).json({ message: "login already in use" });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ login, password: hash, role: role || "user" });

    // issue token
    const token = signToken({ id: user.id, role: user.role, login: user.login });
    return res.status(201).json({ user, token });
};

export const login = async (req: Request, res: Response) => {
    const { login, password } = req.body as { login: string; password: string };
    if (!login || !password) {
        return res.status(400).json({ message: "login and password are required" });
    }

    // т.к. password select:false — явно просим поле
    const user = await User.findOne({ login }).select("+password");
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
        { id: user.id, role: user.role, login: user.login },
        Env.JWT_SECRET,
        { expiresIn: Number(Env.JWT_EXPIRES_IN) }
    );
    setAuthCookie(res, token);

    return res.json({ user: user.toJSON() });
};

export const me = async (req: Request, res: Response) => {
    const userJwt = (req as any).user as { id: string };
    if (!userJwt) return res.status(401).json({ message: "Unauthorized" });
    const user = await User.findById(userJwt.id);

    return res.json({ user });
};

export const logout = (_req: Request, res: Response) => {
    res.clearCookie(COOKIE_NAME, { path: "/" });
    return res.json({ ok: true });
};
