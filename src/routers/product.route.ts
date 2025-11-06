// src/routes/product.route.ts
import { Router } from "express";
import { listProducts } from "@controllers/sk.products.controllers";
import {listProductKaspi, readXmlPriceKaspi} from "@controllers/products/product.controller";

const router = Router();
router.post("/", listProducts);
router.get("/update-kaspi-products", readXmlPriceKaspi);
router.post("/get-kaspi-product", listProductKaspi);

export default router;