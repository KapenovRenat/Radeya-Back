import { Request, Response } from "express";
import {SkladProduct} from "@models/mysklad/SkladProduct";
import firstLetterToEng from "@utils/firstLetterToEng";

// буквы, которые нельзя использовать как вторую
const excludedLetters = ["G", "J", "I", "L", "Y"];

export function getRandomSecondLetter(first: string): string {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    const allowed = letters.filter(
        (l) => l !== first && !excludedLetters.includes(l)
    );
    return allowed[Math.floor(Math.random() * allowed.length)];
}

export function getRandomDigits(): string {
    return String(Math.floor(Math.random() * 1000)).padStart(3, "0");
}

/** Проверяем, есть ли в БД совпадение по артикулу с префиксом */
export async function existsInDb(article: string) {
    const regex = new RegExp(`^${article}(?:-|$)`, "i"); // совпадение MB329 или MB329-1
    return await SkladProduct.exists({ article: { $regex: regex } });
}

export async function RandomArticle(req: Request, res: Response) {
    try {
        const { name, count } = req.body;

        const firstLetter = firstLetterToEng(name[0].toUpperCase());
        const secondLetter = getRandomSecondLetter(firstLetter);
        const prefix = `${firstLetter}${secondLetter}`;

        const result: string[] = [];

        while (result.length < count) {
            const digits = getRandomDigits();
            const candidate = `${prefix}${digits}`;

            // проверка дубликатов в текущей генерации
            if (result.includes(candidate)) continue;

            // проверка в базе по regex (например, MB329 и MB329-1)
            const exists = await existsInDb(candidate);
            if (!exists) {
                result.push(candidate);
            } else {
                // если уже есть в базе — перегенерим цифры, но оставляем тот же prefix
                continue;
            }
        }

        res.json({ ok: true, prefix, data: result });
    } catch (err) {
        console.error("❌ Ошибка получения Артикула:", err);
        res.status(500).json({ message: "Ошибка сервера" });
    }
}