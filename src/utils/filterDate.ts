// npm i date-fns-tz
import { toZonedTime } from "date-fns-tz";

const TZ = "Asia/Almaty";
const pad = (n: number) => String(n).padStart(2, "0");

// month: 1..12
function monthRangeAlmaty(year: number, month: number) {
    const pad = (n: number) => String(n).padStart(2, "0");

    // начало месяца по Алматы
    const startLocal = `${year}-${pad(month)}-01T00:00:00`;
    const startDate = toZonedTime(startLocal, TZ); // UTC
    const startTimestamp = startDate.getTime(); // миллисекунды

    // начало следующего месяца
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endLocal = `${nextYear}-${pad(nextMonth)}-01T00:00:00`;
    const endDate = toZonedTime(endLocal, TZ);
    const endTimestamp = endDate.getTime();

    return { startTimestamp, endTimestamp };
}

export default monthRangeAlmaty;