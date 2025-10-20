// src/routes/product.route.ts
import { Router } from "express";
import { listProducts } from "@controllers/products.controllers";

const router = Router();
router.post("/", listProducts);

export default router;