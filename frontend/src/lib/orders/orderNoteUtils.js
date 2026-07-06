import { API_BASE_URL } from "@/config/api";

export const MAX_NOTE_LENGTH = 1000;
export const MAX_FILE_SIZE_MB = 10;
export const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export function toFileUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const origin = API_BASE_URL.replace(/\/api\/?$/, "");
  return `${origin}${path.startsWith("/") ? "" : "/"}${path}`;
}

export function formatNoteDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

export function formatNotePreview(text, maxLength = 90) {
  const normalized = `${text || ""}`.replace(/\s+/g, " ").trim();
  if (!normalized) return "—";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}…`;
}

export function toHistoryItem(note) {
  return {
    id: note.id,
    date: formatNoteDate(note.noteDate),
    noteDate: note.noteDate || null,
    by: note.authorName || "—",
    note: note.note || "",
    callbackDate: note.callbackDate || "",
    isCalled: Boolean(note.isCalled),
    isReminder: Boolean(note.callbackDate),
    attachmentUrl: toFileUrl(note.attachmentUrl),
  };
}

export function filterNotesByDate(notes, { from = "", to = "" } = {}) {
  if (!from && !to) return notes;

  return notes.filter((note) => {
    const raw = note.noteDate;
    if (!raw) return false;

    const noteDay = new Date(raw);
    if (Number.isNaN(noteDay.getTime())) return false;
    noteDay.setHours(0, 0, 0, 0);

    if (from) {
      const fromDay = new Date(from);
      if (Number.isNaN(fromDay.getTime())) return true;
      fromDay.setHours(0, 0, 0, 0);
      if (noteDay < fromDay) return false;
    }

    if (to) {
      const toDay = new Date(to);
      if (Number.isNaN(toDay.getTime())) return true;
      toDay.setHours(0, 0, 0, 0);
      if (noteDay > toDay) return false;
    }

    return true;
  });
}

export function buildCallbackLine(date = new Date()) {
  return `Calledback - ${date.toLocaleString()}`;
}

export function hasCalledbackLine(text) {
  return /\bCalledback\b/i.test(text) || /\bCallback\s*-/i.test(text);
}

export function validateNoteForm({
  noteText,
  callbackDate,
  attachment,
  existingAttachmentUrl,
}) {
  const errors = {};
  const trimmedNote = `${noteText || ""}`.trim();

  if (!trimmedNote) {
    errors.noteText = "Note text is required.";
  } else if (trimmedNote.length > MAX_NOTE_LENGTH) {
    errors.noteText = `Note cannot be more than ${MAX_NOTE_LENGTH} characters.`;
  }

  if (callbackDate) {
    const selectedDate = new Date(callbackDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
      errors.callbackDate = "Callback date cannot be in the past.";
    }
  }

  if (attachment) {
    const fileSizeMb = attachment.size / (1024 * 1024);
    if (!ALLOWED_FILE_TYPES.includes(attachment.type)) {
      errors.attachment = "Only PDF, Word, JPG, and PNG files are allowed.";
    }
    if (fileSizeMb > MAX_FILE_SIZE_MB) {
      errors.attachment = `File size must be less than ${MAX_FILE_SIZE_MB} MB.`;
    }
  }

  return errors;
}
