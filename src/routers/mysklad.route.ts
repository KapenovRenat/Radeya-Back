import { Router } from "express";
import { getSuppliers, syncSuppliers, getPurchaseOrders, getSalesHistory } from "@controllers/mysklad.controllers";
import { aiPurchaseAnalysis } from "@controllers/ai.controllers";

const router = Router();

router.get("/suppliers", getSuppliers);
router.post("/suppliers/sync", syncSuppliers);
router.get("/purchase-orders", getPurchaseOrders);
router.get("/sales-history", getSalesHistory);
router.post("/ai-purchase", aiPurchaseAnalysis);

export default router;
