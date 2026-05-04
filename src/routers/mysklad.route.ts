import { Router } from "express";
import { getSuppliers, syncSuppliers, getPurchaseOrders, getSalesHistory } from "@controllers/mysklad.controllers";
import { aiPurchaseAnalysis } from "@controllers/ai.controllers";
import { exportPurchaseExcel } from "@controllers/excel.controllers";

const router = Router();

router.get("/suppliers", getSuppliers);
router.post("/suppliers/sync", syncSuppliers);
router.get("/purchase-orders", getPurchaseOrders);
router.get("/sales-history", getSalesHistory);
router.post("/ai-purchase", aiPurchaseAnalysis);
router.post("/export-excel", exportPurchaseExcel);

export default router;
