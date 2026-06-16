const path = require("path");
const fs = require("fs");
const ApiError = require("../utils/ApiError");
const Facility = require("../models/Facility");
const FacilityDocument = require("../models/FacilityDocument");

const DOCUMENT_TYPES = ["Standard", "Legal", "Medical", "Financial", "Other"];

function formatDocumentRow(row) {
  return {
    id: row.id,
    name: row.document_name,
    documentName: row.document_name,
    documentType: row.upload_type,
    fileType: row.file_type,
    uploadedAt: row.uploaded_at,
    fileSizeBytes: row.file_size_bytes,
  };
}

function formatDisplayDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
}

async function ensureFacilityExists(facilityId) {
  const facility = await Facility.findById(facilityId);

  if (!facility) {
    throw new ApiError(404, "Facility not found");
  }

  return facility;
}

async function getDocuments(facilityId) {
  await ensureFacilityExists(facilityId);

  const documents = await FacilityDocument.findByFacilityId(facilityId);

  return documents.map((row) => ({
    ...formatDocumentRow(row),
    date: formatDisplayDate(row.uploaded_at),
  }));
}

async function createDocument(facilityId, file, documentType, uploadedBy) {
  await ensureFacilityExists(facilityId);

  if (!file) {
    throw new ApiError(400, "A file is required");
  }

  const normalizedType = String(documentType || "").trim();

  if (!DOCUMENT_TYPES.includes(normalizedType)) {
    throw new ApiError(400, "Invalid document type");
  }

  const documentId = await FacilityDocument.create({
    facilityId,
    documentName: file.originalname,
    uploadType: normalizedType,
    fileType: FacilityDocument.getFileTypeFromName(file.originalname),
    storagePath: file.path,
    fileSizeBytes: file.size,
    uploadedBy,
  });

  const document = await FacilityDocument.findById(documentId, facilityId);

  return {
    ...formatDocumentRow(document),
    date: formatDisplayDate(document.uploaded_at),
  };
}

async function getDocumentFile(facilityId, documentId) {
  const document = await FacilityDocument.findById(documentId, facilityId);

  if (!document) {
    throw new ApiError(404, "Document not found");
  }

  if (!document.storage_path || !fs.existsSync(document.storage_path)) {
    throw new ApiError(404, "Document file not found on server");
  }

  return document;
}

async function deleteDocument(facilityId, documentId, deletedBy) {
  const document = await FacilityDocument.findById(documentId, facilityId);

  if (!document) {
    throw new ApiError(404, "Document not found");
  }

  await FacilityDocument.softDelete(documentId, facilityId, deletedBy);

  return { message: "Document deleted successfully" };
}

function resolveMimeType(fileType) {
  const normalized = String(fileType || "").toLowerCase();

  const mimeMap = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    txt: "text/plain",
  };

  return mimeMap[normalized] || "application/octet-stream";
}

module.exports = {
  DOCUMENT_TYPES,
  getDocuments,
  createDocument,
  getDocumentFile,
  deleteDocument,
  resolveMimeType,
};
