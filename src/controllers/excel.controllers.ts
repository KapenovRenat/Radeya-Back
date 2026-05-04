import { Request, Response } from "express";
import ExcelJS from "exceljs";

export async function exportPurchaseExcel(req: Request, res: Response) {
    const { items, params, aiTruck, aiSummary } = req.body as {
        items: Array<{
            name: string;
            code: string;
            qty: number;
            deliveryDays: number;
            itemVolume: number;
            totalItemVolume: number | null;
            profitPct: number;
            comment: string;
        }>;
        params: {
            truckVol: number;
            forecastDays: number;
            deliveryDays: number;
            destination: string;
        };
        aiTruck?: { totalVolume: number; truckFillPct: number } | null;
        aiSummary?: string;
    };

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Radeya";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Закупка", {
        pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true },
    });

    // ─── Цвета ───────────────────────────────────────────────
    const BLUE       = "FF3F51B5";
    const LIGHT_BLUE = "FFE8EAF6";
    const GREEN      = "FF388E3C";
    const LIGHT_GREEN= "FFE8F5E9";
    const YELLOW     = "FFF57F17";
    const RED        = "FFD32F2F";
    const GRAY       = "FF616161";
    const WHITE      = "FFFFFFFF";
    const HEADER_BG  = "FF1A237E";

    // ─── Ширины колонок ──────────────────────────────────────
    sheet.columns = [
        { key: "num",         width: 5  },
        { key: "name",        width: 45 },
        { key: "code",        width: 14 },
        { key: "profitPct",   width: 12 },
        { key: "qty",         width: 14 },
        { key: "deliveryDays",width: 12 },
        { key: "itemVolume",  width: 14 },
        { key: "totalVol",    width: 16 },
        { key: "comment",     width: 35 },
    ];

    // ─── Заголовок документа ─────────────────────────────────
    sheet.mergeCells("A1:I1");
    const titleCell = sheet.getCell("A1");
    titleCell.value = `Список закупки — ${params.destination}`;
    titleCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: WHITE } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };
    sheet.getRow(1).height = 32;

    // ─── Параметры ───────────────────────────────────────────
    const date = new Date().toLocaleDateString("ru-RU");
    sheet.mergeCells("A2:I2");
    const paramCell = sheet.getCell("A2");
    paramCell.value = `Дата: ${date}   |   Объём машины: ${params.truckVol} м³   |   Срок доставки: ${params.deliveryDays} дн   |   Период заказов: ${params.forecastDays} дн`;
    paramCell.font = { name: "Calibri", size: 10, color: { argb: WHITE } };
    paramCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
    paramCell.alignment = { vertical: "middle", horizontal: "center" };
    sheet.getRow(2).height = 20;

    // ─── Заполнение машины ───────────────────────────────────
    if (aiTruck) {
        sheet.mergeCells("A3:I3");
        const truckCell = sheet.getCell("A3");
        truckCell.value = `🚛  Объём заказа: ${aiTruck.totalVolume} м³ из ${params.truckVol} м³   |   Заполнение машины: ${aiTruck.truckFillPct}%`;
        truckCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: HEADER_BG } };
        truckCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EAF6" } };
        truckCell.alignment = { vertical: "middle", horizontal: "center" };
        sheet.getRow(3).height = 20;
    }

    const dataStartRow = aiTruck ? 5 : 4;

    // ─── Заголовки таблицы ───────────────────────────────────
    const headers = ["#", "Наименование", "Код", "Рент-ть", "Заказать, шт", "Срок, дн", "Объём ед., м³", "Объём итого, м³", "Комментарий"];
    const headerRow = sheet.getRow(dataStartRow);
    headers.forEach((h, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = h;
        cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: WHITE } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        cell.border = {
            top: { style: "thin", color: { argb: WHITE } },
            bottom: { style: "thin", color: { argb: WHITE } },
            left: { style: "thin", color: { argb: WHITE } },
            right: { style: "thin", color: { argb: WHITE } },
        };
    });
    headerRow.height = 28;

    // ─── Данные ──────────────────────────────────────────────
    items.forEach((item, idx) => {
        const rowIdx = dataStartRow + 1 + idx;
        const row = sheet.getRow(rowIdx);
        const isEven = idx % 2 === 0;
        const bg = isEven ? "FFFFFFFF" : "FFF5F5FF";

        const values = [
            idx + 1,
            item.name,
            item.code,
            item.profitPct,
            item.qty,
            item.deliveryDays,
            item.itemVolume > 0 ? item.itemVolume : null,
            item.totalItemVolume ?? null,
            item.comment,
        ];

        values.forEach((val, ci) => {
            const cell = row.getCell(ci + 1);
            cell.value = val;
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
            cell.font = { name: "Calibri", size: 10 };
            cell.alignment = { vertical: "middle", wrapText: ci === 1 || ci === 8 };
            cell.border = {
                top:    { style: "hair", color: { argb: "FFD0D0D0" } },
                bottom: { style: "hair", color: { argb: "FFD0D0D0" } },
                left:   { style: "hair", color: { argb: "FFD0D0D0" } },
                right:  { style: "hair", color: { argb: "FFD0D0D0" } },
            };

            // Рент-ть — цвет текста
            if (ci === 3 && typeof val === "number") {
                cell.font = { name: "Calibri", size: 10, bold: true,
                    color: { argb: val >= 30 ? GREEN : val >= 0 ? YELLOW : RED } };
                cell.value = `${val}%`;
                cell.alignment = { horizontal: "center", vertical: "middle" };
            }
            // Кол-во — жирный
            if (ci === 4) {
                cell.font = { name: "Calibri", size: 10, bold: true };
                cell.alignment = { horizontal: "center", vertical: "middle" };
            }
            // Числовые колонки — по центру
            if ([0, 2, 5, 6, 7].includes(ci)) {
                cell.alignment = { horizontal: "center", vertical: "middle" };
            }
        });

        row.height = 20;
    });

    // ─── Итоговая строка ─────────────────────────────────────
    const totalRow = sheet.getRow(dataStartRow + 1 + items.length + 1);
    sheet.mergeCells(`A${totalRow.number}:D${totalRow.number}`);
    const totalCell = sheet.getCell(`A${totalRow.number}`);
    totalCell.value = `Итого позиций: ${items.length}`;
    totalCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: WHITE } };
    totalCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
    totalCell.alignment = { horizontal: "center", vertical: "middle" };

    const totalQtyCell = sheet.getCell(`E${totalRow.number}`);
    totalQtyCell.value = items.reduce((s, i) => s + i.qty, 0);
    totalQtyCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: WHITE } };
    totalQtyCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
    totalQtyCell.alignment = { horizontal: "center", vertical: "middle" };

    const totalVolCell = sheet.getCell(`H${totalRow.number}`);
    totalVolCell.value = aiTruck?.totalVolume ?? null;
    totalVolCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: WHITE } };
    totalVolCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
    totalVolCell.alignment = { horizontal: "center", vertical: "middle" };
    totalRow.height = 24;

    // ─── Резюме AI ───────────────────────────────────────────
    if (aiSummary) {
        const summaryRowIdx = dataStartRow + 1 + items.length + 3;
        sheet.mergeCells(`A${summaryRowIdx}:I${summaryRowIdx}`);
        const labelCell = sheet.getCell(`A${summaryRowIdx}`);
        labelCell.value = "Резюме AI:";
        labelCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: HEADER_BG } };

        sheet.mergeCells(`A${summaryRowIdx + 1}:I${summaryRowIdx + 1}`);
        const summaryCell = sheet.getCell(`A${summaryRowIdx + 1}`);
        summaryCell.value = aiSummary;
        summaryCell.font = { name: "Calibri", size: 10, color: { argb: GRAY } };
        summaryCell.alignment = { wrapText: true, vertical: "top" };
        sheet.getRow(summaryRowIdx + 1).height = 60;
    }

    // ─── Отдаём файл ─────────────────────────────────────────
    const filename = `zakupka_${params.destination}_${date.replace(/\./g, "-")}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    await workbook.xlsx.write(res);
    res.end();
}
