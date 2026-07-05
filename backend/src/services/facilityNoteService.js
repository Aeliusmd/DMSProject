const path = require("path");
const fs = require("fs");
const ApiError = require("../utils/ApiError");
const Facility = require("../models/Facility");
const FacilityNote = require("../models/FacilityNote");
const FacilityNoteAttachment = require("../models/FacilityNoteAttachment");
const Employee = require("../models/Employee");

const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "text/plain",
]);

const MAX_ATTACHMENT_SIZE_BYTES = 15 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_NOTE = 10;

function formatDisplayDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
}

function mapAttachmentRow(row, facilityId) {
  return {
    id: row.id,
    fileName: row.original_filename || "attachment",
    originalFilename: row.original_filename || "",
    mimeType: row.mime_type || "",
    fileSizeBytes: row.file_size_bytes || 0,
    downloadUrl: `/facilities/${facilityId}/notes/${row.facility_note_id}/attachments/${row.id}/download`,
  };
}

function mapNoteRow(row, attachmentsByNoteId = {}, facilityId) {
  const attachments = attachmentsByNoteId[row.id] || [];

  return {
    id: row.id,
    date: formatDisplayDate(row.note_date),
    by: row.author_name || "",
    authorName: row.author_name || "",
    note: row.note || "",
    noteDate: formatDisplayDate(row.note_date),
    createdBy: row.created_by,
    createdAt: row.created_at,
    attachments: attachments.map((attachment) =>
      mapAttachmentRow(attachment, facilityId)
    ),
  };
}

async function ensureFacilityExists(facilityId) {
  const facility = await Facility.findById(facilityId);

  if (!facility) {
    throw new ApiError(404, "Facility not found");
  }

  return facility;
}

function validateAttachmentFiles(files = []) {
  if (!files.length) return;

  if (files.length > MAX_ATTACHMENTS_PER_NOTE) {
    throw new ApiError(
      400,
      `You can upload up to ${MAX_ATTACHMENTS_PER_NOTE} files per note`
    );
  }

  files.forEach((file) => {
    if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(file.mimetype)) {
      throw new ApiError(
        400,
        "Only PDF, Word, image, or text files are allowed"
      );
    }

    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new ApiError(400, "Each attachment must be 15 MB or less");
    }
  });
}

async function getNotes(facilityId) {
  await ensureFacilityExists(facilityId);

  const notes = await FacilityNote.findByFacilityId(facilityId);
  const noteIds = notes.map((note) => note.id);
  const attachments = await FacilityNoteAttachment.findByNoteIds(noteIds);

  const attachmentsByNoteId = attachments.reduce((acc, attachment) => {
    if (!acc[attachment.facility_note_id]) {
      acc[attachment.facility_note_id] = [];
    }
    acc[attachment.facility_note_id].push(attachment);
    return acc;
  }, {});

  return notes.map((note) =>
    mapNoteRow(note, attachmentsByNoteId, facilityId)
  );
}

async function createNote(facilityId, { note }, actorId, files = []) {
  await ensureFacilityExists(facilityId);

  const trimmedNote = String(note || "").trim();

  if (!trimmedNote) {
    throw new ApiError(400, "Validation failed", [
      { field: "note", message: "Note is required" },
    ]);
  }

  if (trimmedNote.length > 500) {
    throw new ApiError(400, "Validation failed", [
      { field: "note", message: "Note must be 500 characters or less" },
    ]);
  }

  validateAttachmentFiles(files);

  const employee = await Employee.findByIdPublic(actorId);

  if (!employee) {
    throw new ApiError(404, "User not found");
  }

  const created = await FacilityNote.create({
    facilityId,
    noteDate: new Date().toISOString().slice(0, 10),
    createdBy: actorId,
    authorName: employee.name || "Unknown",
    note: trimmedNote,
  });

  if (!created) {
    throw new ApiError(500, "Failed to create note");
  }

  let savedAttachments = [];

  if (files.length) {
    savedAttachments = await FacilityNoteAttachment.createMany(
      files.map((file) => ({
        facilityNoteId: created.id,
        storagePath: file.path,
        originalFilename: file.originalname || "attachment",
        mimeType: file.mimetype || "",
        fileSizeBytes: file.size || 0,
      }))
    );
  }

  const attachmentsByNoteId = {
    [created.id]: savedAttachments,
  };

  return mapNoteRow(created, attachmentsByNoteId, facilityId);
}

async function getAttachmentFile(facilityId, noteId, attachmentId) {
  await ensureFacilityExists(facilityId);

  const notes = await FacilityNote.findByFacilityId(facilityId);
  const note = notes.find((row) => Number(row.id) === Number(noteId));

  if (!note) {
    throw new ApiError(404, "Note not found");
  }

  const attachment = await FacilityNoteAttachment.findById(attachmentId, noteId);

  if (!attachment) {
    throw new ApiError(404, "Attachment not found");
  }

  if (!attachment.storage_path || !fs.existsSync(attachment.storage_path)) {
    throw new ApiError(404, "Attachment file not found on server");
  }

  return attachment;
}

function resolveMimeType(fileName, mimeType) {
  if (mimeType) return mimeType;

  const extension = path.extname(fileName || "").toLowerCase();

  const map = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".txt": "text/plain",
  };

  return map[extension] || "application/octet-stream";
}

module.exports = {
  getNotes,
  createNote,
  getAttachmentFile,
  resolveMimeType,
};
