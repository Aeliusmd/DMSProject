const path = require("path");
const fs = require("fs");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const facilityDocumentService = require("../services/facilityDocumentService");
const facilityService = require("../services/facilityService");
const activityLogService = require("../services/activityLogService");

function buildFacilityLogBase(req, facility) {
  return {
    facilityId: Number(facility.id),
    companyName: facility.facilityName,
    targetEmployeeId: req.user?.id,
  };
}

exports.listDocuments = asyncHandler(async (req, res) => {
  const documents = await facilityDocumentService.getDocuments(req.params.id);
  return ApiResponse.success(res, { documents });
});

exports.uploadDocument = asyncHandler(async (req, res) => {
  const facility = await facilityService.getFacilityById(req.params.id);
  const document = await facilityDocumentService.createDocument(
    req.params.id,
    req.file,
    req.body.documentType,
    req.user.id
  );

  await activityLogService.recordFromRequest(req, {
    ...buildFacilityLogBase(req, facility),
    context: "facilities",
    action: "upload_document",
    details: `Uploaded document "${document.documentName}" (${document.documentType}) to ${facility.facilityName}`,
  });

  return ApiResponse.created(res, { document }, "Document uploaded successfully");
});

exports.downloadDocument = asyncHandler(async (req, res) => {
  const document = await facilityDocumentService.getDocumentFile(
    req.params.id,
    req.params.documentId
  );

  const mimeType = facilityDocumentService.resolveMimeType(document.file_type);

  res.setHeader("Content-Type", mimeType);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${path.basename(document.document_name)}"`
  );
  res.sendFile(path.resolve(document.storage_path));
});

exports.previewDocument = asyncHandler(async (req, res) => {
  const document = await facilityDocumentService.getDocumentFile(
    req.params.id,
    req.params.documentId
  );

  const mimeType = facilityDocumentService.resolveMimeType(document.file_type);

  res.setHeader("Content-Type", mimeType);
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${path.basename(document.document_name)}"`
  );

  fs.createReadStream(document.storage_path).pipe(res);
});

exports.deleteDocument = asyncHandler(async (req, res) => {
  const facility = await facilityService.getFacilityById(req.params.id);
  const document = await facilityDocumentService.getDocumentFile(
    req.params.id,
    req.params.documentId
  );

  const result = await facilityDocumentService.deleteDocument(
    req.params.id,
    req.params.documentId,
    req.user.id
  );

  await activityLogService.recordFromRequest(req, {
    ...buildFacilityLogBase(req, facility),
    context: "facilities",
    action: "delete_document",
    details: `Deleted document "${document.document_name}" from ${facility.facilityName}`,
  });

  return ApiResponse.success(res, result, result.message);
});
