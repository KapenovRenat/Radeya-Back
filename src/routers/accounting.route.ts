import { Router } from "express";
import {createAccounting, getAccounting} from "@controllers/accounting.controllers";


const router = Router();

router.post("/create-accounting", createAccounting);
router.post("/list-accounting", getAccounting);

export default router;