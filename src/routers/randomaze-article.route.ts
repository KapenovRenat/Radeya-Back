import { Router } from "express";
import {RandomArticle} from "@controllers/randomaze-article.controllers";

const router = Router();
router.post("/", RandomArticle);

export default router;