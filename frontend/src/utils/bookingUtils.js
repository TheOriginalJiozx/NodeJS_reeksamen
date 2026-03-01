const today = (() => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
})();

function groupContinuousDates(dates) {
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

function nextYMD(date) {
  const [year, month, day] = date.split("-").map(Number);
  const selectable = new Date(year, month - 1, day);
  selectable.setDate(selectable.getDate() + 1);
  const availableYear = selectable.getFullYear();
  const availableMonth = String(selectable.getMonth() + 1).padStart(2, "0");
  const availableDay = String(selectable.getDate()).padStart(2, "0");
  return `${availableYear}-${availableMonth}-${availableDay}`;
}

function contiguousEndDates(start, availableDatesList) {
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

function computeOwnerAvailable(availableDates) {
  const out = [];
  for (let i = 0; i < 365; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const fullDate = `${year}-${month}-${day}`;
    if (!availableDates.includes(fullDate)) out.push(fullDate);
  }
  return out;
}

export { today, groupContinuousDates, contiguousEndDates, computeOwnerAvailable };
