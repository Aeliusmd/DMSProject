export function getEmptyReminderForm() {
  return {
    caseNumber: "",
    applicant: "",
    note: "",
    callbackDate: "",
    attachment: null,
  };
}

export function validateReminderForm(data) {
  const errors = {};

  if (!data.caseNumber.trim()) {
    errors.caseNumber = "Case number is required";
  }

  if (!data.applicant.trim()) {
    errors.applicant = "Applicant is required";
  }

  if (!data.note.trim()) {
    errors.note = "Note is required";
  }

  if (!data.callbackDate) {
    errors.callbackDate = "Callback date is required";
  } else if (!isValidDateInput(data.callbackDate)) {
    errors.callbackDate = "Select a valid callback date";
  }

  return errors;
}

export function validateReminderField(field, value) {
  if (field === "attachment") return "";

  if (field === "callbackDate") {
    if (!value) return "Callback date is required";
    if (!isValidDateInput(value)) return "Select a valid callback date";
    return "";
  }

  if (typeof value === "string" && !value.trim()) {
    if (field === "caseNumber") return "Case number is required";
    if (field === "applicant") return "Applicant is required";
    if (field === "note") return "Note is required";
  }

  return "";
}

export function toDateInputValue(value) {
  if (!value) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const parts = value.split("/");

  if (parts.length !== 3) {
    return "";
  }

  const [month, day, year] = parts;
  const fullYear = year.length === 2 ? `20${year}` : year;

  return `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function formatDateForDisplay(value) {
  if (!value) return "";

  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${month}/${day}/${year.slice(-2)}`;
}

export function isValidDateInput(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function getNextReminderId(reminders) {
  const maxId = reminders.reduce((max, item) => Math.max(max, item.id), 0);
  return maxId + 1;
}

export function getCurrentReminderDate() {
  const now = new Date();

  const date = now.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
  });

  const time = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return `${date} ${time.replace(" ", "")}`;
}