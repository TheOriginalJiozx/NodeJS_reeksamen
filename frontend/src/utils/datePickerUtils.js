import flatpickr from "flatpickr";

function setupDatePickers(startElement, endElement, today, ownerAvailable, availableEndOptions, callbacks) {
  const { onStartDateChange, onEndDateChange } = callbacks;

  const startFlatPickr = flatpickr(startElement, {
    dateFormat: "Y-m-d",
    enable: ownerAvailable,
    minDate: today,
    onChange: (_selectedDates, dateString) => onStartDateChange?.(dateString),
  });

  const endFlatPickr = flatpickr(endElement, {
    dateFormat: "Y-m-d",
    enable: availableEndOptions,
    minDate: today,
    onChange: (_selectedDates, dateString) => onEndDateChange?.(dateString),
  });

  return { startFlatPickr, endFlatPickr };
}

function updateEndDatePicker(endFlatPickr, availableEndOptions, startDate, today, availableEndDate, clearCallback) {
  if (!endFlatPickr) return;

  endFlatPickr.set("enable", availableEndOptions);
  endFlatPickr.set("minDate", startDate || today);

  if (availableEndDate && !availableEndOptions.includes(availableEndDate)) {
    try {
      endFlatPickr.clear();
      clearCallback?.();
    } catch (error) {
      // Handle clear error
    }
  }
}

export { setupDatePickers, updateEndDatePicker };
