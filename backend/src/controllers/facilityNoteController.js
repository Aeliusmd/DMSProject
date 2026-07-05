const path = require("path");
const fs = require("fs");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const facilityNoteService = require("../services/facilityNoteService");
const facilityService = require("../services/facilityService");
const activityLogService = require("../services/activityLogService");
const notificationService = require("../services/notificationService");

exports.listNotes = asyncHandler(async (req, res) => {
  const notes = await facilityNoteService.getNotes(req.params.id);
  return ApiResponse.success(res, { notes });
});

exports.createNote = asyncHandler(async (req, res) => {
  const facility = await facilityService.getFacilityById(req.params.id);
  const files = Array.isArray(req.files) ? req.files : [];
  const note = await facilityNoteService.createNote(
    req.params.id,
    req.body,
    req.user.id,
    files
  );

  const attachmentSuffix =
    files.length > 0
      ? ` with ${files.length} attachment${files.length === 1 ? "" : "s"}`
      : "";

  await activityLogService.recordFromRequest(req, {
    facilityId: Number(req.params.id),
    companyName: facility.facilityName,
    targetEmployeeId: req.user?.id,
    context: "notes",
    action: "create_note",
    details: `Added note to facility ${facility.facilityName}${attachmentSuffix}`,
  });

  await notificationService.notifyFacilityEvent({
    title: "Facility Note Added",
    description: `New note on ${facility.facilityName}`,
    facilityId: facility.id,
  });

  return ApiResponse.created(res, { note }, "Note created successfully");
});

exports.downloadAttachment = asyncHandler(async (req, res) => {
  const attachment = await facilityNoteService.getAttachmentFile(
    req.params.id,
    req.params.noteId,
    req.params.attachmentId
  );

  const mimeType = facilityNoteService.resolveMimeType(
    attachment.original_filename,
    attachment.mime_type
  );

  res.setHeader("Content-Type", mimeType);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${path.basename(attachment.original_filename)}"`
  );

  return res.send(fs.readFileSync(attachment.storage_path));
});
