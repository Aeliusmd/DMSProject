/** Local calendar date as YYYY-MM-DD (for date inputs). */
export function getTodayInputDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

/** Local datetime as YYYY-MM-DDTHH:mm for datetime-local inputs. */
export function toDateTimeLocalValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Earliest selectable future datetime-local value (next minute). */
export function getMinFutureDateTimeLocal() {
  const nextMinute = new Date();
  nextMinute.setSeconds(0, 0);
  nextMinute.setMinutes(nextMinute.getMinutes() + 1);
  return toDateTimeLocalValue(nextMinute);
}

export function isFutureDateTimeLocal(value) {
  if (!value) return false;

  const selected = new Date(value);
  if (Number.isNaN(selected.getTime())) return false;

  return selected.getTime() > Date.now();
}
