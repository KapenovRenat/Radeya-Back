// src/routes/product.route.ts
import { Router } from "express";
import { listProducts } from "@controllers/sk.products.controllers";
import {readXmlPriceKaspi} from "@controllers/products/product.controller";

const router = Router();
router.post("/", listProducts);
router.get("/update-kaspi-products", readXmlPriceKaspi);

export default router;