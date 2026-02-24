export const datesBetween = (start, end) => {
  const dates = [];
  const startDate = new Date(start);
  const endDate = new Date(end);

  while (startDate <= endDate) {
    const year = startDate.getFullYear();
    const month = String(startDate.getMonth() + 1).padStart(2, "0");
    const day = String(startDate.getDate()).padStart(2, "0");
    dates.push(`${year}-${month}-${day}`);
    startDate.setDate(startDate.getDate() + 1);
  }

  return dates;
};
