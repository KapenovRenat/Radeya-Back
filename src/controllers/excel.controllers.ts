import { Request, Response } from "express";
import ExcelJS from "exceljs";

export async function exportPurchaseExcel(req: Request, res: Response) {
    const { items, params, aiTruck, aiSummary } = req.body as {
        items: Array<{
            name: string;
            code: string;
            qty: number;
            neededQty?: number | null;
            salesPerDay?: number | null;
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
            coverageDays: number;
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
    const GREEN      = "FF388E3C";
    const YELLOW     = "FFF57F17";
    const ORANGE     = "FFE65100";
    const RED        = "FFD32F2F";
    const GRAY       = "FF616161";
    const WHITE      = "FFFFFFFF";
    const HEADER_BG  = "FF1A237E";
    const AMBER_BG   = "FFFFF8E1";
    const AMBER_HDR  = "FFF9A825";

    // ─── Ширины колонок (A–K, 11 столбцов) ──────────────────
    // A   B     C     D          E     F           G              H             I            J         K
    sheet.columns = [
        { key: "num",         width: 5  },  // A
        { key: "name",        width: 45 },  // B
        { key: "code",        width: 14 },  // C
        { key: "profitPct",   width: 12 },  // D
        { key: "salesPerDay", width: 14 },  // E  Прод/день
        { key: "qty",         width: 14 },  // F  Заказать, шт
        { key: "neededQty",   width: 14 },  // G  Нужно всего
        { key: "deliveryDays",width: 12 },  // H
        { key: "itemVolume",  width: 14 },  // I
        { key: "totalVol",    width: 16 },  // J
        { key: "comment",     width: 35 },  // K
    ];

    // ─── Заголовок документа ─────────────────────────────────
    sheet.mergeCells("A1:K1");
    const titleCell = sheet.getCell("A1");
    titleCell.value = `Список закупки — ${params.destination}`;
    titleCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: WHITE } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };
    sheet.getRow(1).height = 32;

    // ─── Параметры ───────────────────────────────────────────
    const date = new Date().toLocaleDateString("ru-RU");
    sheet.mergeCells("A2:K2");
    const paramCell = sheet.getCell("A2");
    paramCell.value = `Дата: ${date}   |   Объём машины: ${params.truckVol} м³   |   Срок изготовления: ${params.forecastDays} дн   |   Срок доставки: ${params.deliveryDays} дн   |   Полный срок: ${params.forecastDays + params.deliveryDays} дн   |   Горизонт покрытия: ${params.coverageDays} дн`;
    paramCell.font = { name: "Calibri", size: 10, color: { argb: WHITE } };
    paramCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
    paramCell.alignment = { vertical: "middle", horizontal: "center" };
    sheet.getRow(2).height = 20;

    // ─── Заполнение машины ───────────────────────────────────
    if (aiTruck) {
        sheet.mergeCells("A3:K3");
        const truckCell = sheet.getCell("A3");
        truckCell.value = `🚛  Объём заказа: ${aiTruck.totalVolume} м³ из ${params.truckVol} м³   |   Заполнение машины: ${aiTruck.truckFillPct}%`;
        truckCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: HEADER_BG } };
        truckCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EAF6" } };
        truckCell.alignment = { vertical: "middle", horizontal: "center" };
        sheet.getRow(3).height = 20;
    }

    const dataStartRow = aiTruck ? 5 : 4;

    // ─── Заголовки таблицы ───────────────────────────────────
    // Колонки: # | Наименование | Код | Рент-ть | Прод/день | Заказать,шт | Нужно всего | Срок,дн | Объём ед. | Объём итого | Комментарий
    const headers = [
        "#",
        "Наименование",
        "Код",
        "Рент-ть",
        "Прод/день",
        "Заказать, шт",
        "Нужно всего",
        "Срок, дн",
        "Объём ед., м³",
        "Объём итого, м³",
        "Комментарий",
    ];
    const headerRow = sheet.getRow(dataStartRow);
    headers.forEach((h, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = h;
        // Колонка "Прод/день" (индекс 4) — голубоватый, "Нужно всего" (индекс 6) — янтарный
        const isNeeded = i === 6;
        cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: isNeeded ? HEADER_BG : WHITE } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isNeeded ? AMBER_HDR : BLUE } };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        cell.border = {
            top:    { style: "thin", color: { argb: WHITE } },
            bottom: { style: "thin", color: { argb: WHITE } },
            left:   { style: "thin", color: { argb: WHITE } },
            right:  { style: "thin", color: { argb: WHITE } },
        };
    });
    headerRow.height = 28;

    // ─── Данные ──────────────────────────────────────────────
    items.forEach((item, idx) => {
        const rowIdx = dataStartRow + 1 + idx;
        const row = sheet.getRow(rowIdx);
        const isEven = idx % 2 === 0;

        const comment = item.comment ?? "";
        const isCritical    = comment.startsWith("КРИТИЧНО");
        const isUrgent      = comment.startsWith("СРОЧНО");
        const isAdditional  = comment.startsWith("ДОПОЛНИТЕЛЬНО");

        // Фон строки по типу комментария
        const bg = isCritical   ? "FFFFF3F3"
                 : isUrgent     ? "FFFFF8EC"
                 : isAdditional ? "FFF1F8F1"
                 : isEven       ? "FFFFFFFF"
                 : "FFF5F5FF";

        // ci: 0=#  1=name  2=code  3=profitPct  4=salesPerDay  5=qty  6=neededQty  7=deliveryDays  8=itemVolume  9=totalVol  10=comment
        const values = [
            idx + 1,
            item.name,
            item.code,
            item.profitPct,
            item.salesPerDay ?? null,
            item.qty,
            item.neededQty ?? null,
            item.deliveryDays,
            item.itemVolume > 0 ? item.itemVolume : null,
            item.totalItemVolume ?? null,
            item.comment,
        ];

        values.forEach((val, ci) => {
            const cell = row.getCell(ci + 1);
            cell.value = val;
            const isNeededCol = ci === 6;
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isNeededCol ? AMBER_BG : bg } };
            cell.font = { name: "Calibri", size: 10 };
            cell.alignment = { vertical: "middle", wrapText: ci === 1 || ci === 9 };
            cell.border = {
                top:    { style: "hair", color: { argb: "FFD0D0D0" } },
                bottom: { style: "hair", color: { argb: "FFD0D0D0" } },
                left:   { style: "hair", color: { argb: "FFD0D0D0" } },
                right:  { style: "hair", color: { argb: "FFD0D0D0" } },
            };

            // Рент-ть — цветной текст
            if (ci === 3 && typeof val === "number") {
                cell.font = { name: "Calibri", size: 10, bold: true,
                    color: { argb: val >= 30 ? GREEN : val >= 0 ? YELLOW : RED } };
                cell.value = `${val}%`;
                cell.alignment = { horizontal: "center", vertical: "middle" };
            }
            // Прод/день — серый мелкий
            if (ci === 4) {
                cell.font = { name: "Calibri", size: 10, color: { argb: GRAY } };
                cell.alignment = { horizontal: "center", vertical: "middle" };
            }
            // Заказать, шт — жирный синий
            if (ci === 5) {
                cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: BLUE } };
                cell.alignment = { horizontal: "center", vertical: "middle" };
            }
            // Нужно всего — показываем разницу цветом
            if (ci === 6 && typeof item.neededQty === "number" && typeof item.qty === "number") {
                const diff = item.neededQty - item.qty;
                cell.font = {
                    name: "Calibri", size: 10, bold: true,
                    color: { argb: diff > 0 ? ORANGE : GREEN },
                };
                cell.value = diff > 0 ? `${item.neededQty} (-${diff})` : String(item.neededQty);
                cell.alignment = { horizontal: "center", vertical: "middle" };
            }
            // Числовые колонки — по центру
            if ([0, 2, 7, 8, 9].includes(ci)) {
                cell.alignment = { horizontal: "center", vertical: "middle" };
            }
            // Комментарий — цвет текста по типу
            if (ci === 10) {
                const commentColor = isCritical   ? RED
                                   : isUrgent     ? YELLOW
                                   : isAdditional ? GREEN
                                   : GRAY;
                cell.font = { name: "Calibri", size: 10, color: { argb: commentColor } };
                cell.alignment = { vertical: "middle", wrapText: true };
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

    // F — итого заказать
    const totalQtyCell = sheet.getCell(`F${totalRow.number}`);
    totalQtyCell.value = items.reduce((s, i) => s + i.qty, 0);
    totalQtyCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: WHITE } };
    totalQtyCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
    totalQtyCell.alignment = { horizontal: "center", vertical: "middle" };

    // G — итого нужно всего
    const totalNeededCell = sheet.getCell(`G${totalRow.number}`);
    const neededSum = items.reduce((s, i) => s + (i.neededQty ?? i.qty), 0);
    totalNeededCell.value = neededSum;
    totalNeededCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: HEADER_BG } };
    totalNeededCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER_HDR } };
    totalNeededCell.alignment = { horizontal: "center", vertical: "middle" };

    // J — итого объём
    const totalVolCell = sheet.getCell(`J${totalRow.number}`);
    totalVolCell.value = aiTruck?.totalVolume ?? null;
    totalVolCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: WHITE } };
    totalVolCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
    totalVolCell.alignment = { horizontal: "center", vertical: "middle" };
    totalRow.height = 24;

    // ─── Резюме AI ───────────────────────────────────────────
    if (aiSummary) {
        const summaryRowIdx = dataStartRow + 1 + items.length + 3;
        sheet.mergeCells(`A${summaryRowIdx}:K${summaryRowIdx}`);
        const labelCell = sheet.getCell(`A${summaryRowIdx}`);
        labelCell.value = "Резюме AI:";
        labelCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: HEADER_BG } };

        sheet.mergeCells(`A${summaryRowIdx + 1}:K${summaryRowIdx + 1}`);
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
