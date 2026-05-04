import { Router } from "express";
import { getSuppliers, syncSuppliers, getPurchaseOrders, getSalesHistory } from "@controllers/mysklad.controllers";

const router = Router();

router.get("/suppliers", getSuppliers);
router.post("/suppliers/sync", syncSuppliers);
router.get("/purchase-orders", getPurchaseOrders);
router.get("/sales-history", getSalesHistory);

export default router;
