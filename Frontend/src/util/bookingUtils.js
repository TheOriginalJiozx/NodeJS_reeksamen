export const today = (() => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
})();

export function groupContinuousDates(dates) {
    const ranges = [];
    if (!dates || dates.length === 0) return ranges;
    let start = dates[0];
    let end = dates[0];
    const toYmd = (string) => {
        const [year, month, day] = string.split("-").map(Number);
        return new Date(year, month - 1, day);
    };
    for (let i = 1; i < dates.length; i++) {
        const previous = toYmd(end);
        const current = toYmd(dates[i]);
        const nextDay = new Date(previous);
        nextDay.setDate(nextDay.getDate() + 1);
        if (
            current.getFullYear() === nextDay.getFullYear() &&
            current.getMonth() === nextDay.getMonth() &&
            current.getDate() === nextDay.getDate()
        ) {
            end = dates[i];
        } else {
            ranges.push({ start, end });
            start = dates[i];
            end = dates[i];
        }
    }
    ranges.push({ start, end });
    return ranges;
}

export function formatRange(range) {
    if (!range) return "";
    const [startYear, startMonth, startDay] = range.start
        .split("-")
        .map(Number);
    const [endYear, endMonth, endDay] = range.end.split("-").map(Number);
    if (startYear === endYear && startMonth === endMonth) {
        return `${startDay}-${endDay}/${startMonth}`;
    }
    if (startYear === endYear) {
        return `${startDay}/${startMonth}-${endDay}/${endMonth}`;
    }
    return `${startDay}/${startMonth}/${startYear}-${endDay}/${endMonth}/${endYear}`;
}

export function nextYMD(date) {
    const [year, month, day] = date.split("-").map(Number);
    const selectable = new Date(year, month - 1, day);
    selectable.setDate(selectable.getDate() + 1);
    const availableYear = selectable.getFullYear();
    const availableMonth = String(selectable.getMonth() + 1).padStart(2, "0");
    const availableDay = String(selectable.getDate()).padStart(2, "0");
    return `${availableYear}-${availableMonth}-${availableDay}`;
}

export function computeAvailableDatesFromAvailabilities(availabilities) {
    const set = new Set();
    for (const available of availabilities || []) {
        if (!available.startDate || !available.endDate) continue;
        const start = new Date(available.startDate);
        const end = new Date(available.endDate);
        for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            set.add(`${year}-${month}-${day}`);
        }
    }
    return Array.from(set).sort();
}

export function contiguousEndDates(start, availableDatesList) {
    if (!start) return [];
    const set = new Set(availableDatesList || []);
    const out = [];
    let current = start;
    if (!set.has(current)) return [];
    out.push(current);
    while (true) {
        const next = nextYMD(current);
        if (!set.has(next)) break;
        out.push(next);
        current = next;
    }
    return out;
}
