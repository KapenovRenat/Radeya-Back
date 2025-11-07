// src/routes/product.route.ts
import { Router } from "express";
import { listProducts } from "@controllers/sk.products.controllers";
import {
    getCategoriesProductKaspi,
    getFieldCategoryKaspiProduct,
    listProductKaspi,
    readXmlPriceKaspi
} from "@controllers/products/product.controller";

const router = Router();
router.post("/", listProducts);
router.get("/update-kaspi-products", readXmlPriceKaspi);
router.post("/get-kaspi-product", listProductKaspi);
router.post("/get-category-kaspi-product", getCategoriesProductKaspi);
router.post("/get-fields-kaspi-product", getFieldCategoryKaspiProduct);

export default router;