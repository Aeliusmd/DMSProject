const DRAFT_STORAGE_KEY = "personalRequestDraft";

export function loadPersonalRequestDraft() {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function savePersonalRequestDraft(payload) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

let draftSaveTimer = null;

export function savePersonalRequestDraftDebounced(payload, delayMs = 400) {
  if (typeof window === "undefined") return;
  if (draftSaveTimer) clearTimeout(draftSaveTimer);
  draftSaveTimer = setTimeout(() => {
    draftSaveTimer = null;
    savePersonalRequestDraft(payload);
  }, delayMs);
}

export function clearPersonalRequestDraft() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // ignore
  }
}
