const STORAGE_PREFIX = "dms_reminder_popup";

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getReminderPopupStorageKey(userId) {
  return `${STORAGE_PREFIX}_${userId}_${getTodayKey()}`;
}

export function wasReminderPopupShownToday(userId) {
  if (!userId || typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(getReminderPopupStorageKey(userId)) === "1";
}

export function markReminderPopupShownToday(userId) {
  if (!userId || typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getReminderPopupStorageKey(userId), "1");
}
