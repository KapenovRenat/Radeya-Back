import { Router } from "express";
import { register, login, me, logout } from "@controllers/auth.controller";
import { auth, requireRole } from "@middleware/auth";


const router = Router();

// регистрация и логин
router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);

// текущий пользователь
router.get("/me", auth, me);

// пример защищённого эндпоинта только для admin
router.get("/admin-only", auth, requireRole("admin"), (_req, res) => {
    res.json({ ok: true, message: "Hello admin!" });
});

export default router;
