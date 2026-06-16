const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const facilityNoteService = require("../services/facilityNoteService");
const facilityService = require("../services/facilityService");
const activityLogService = require("../services/activityLogService");

exports.listNotes = asyncHandler(async (req, res) => {
  const notes = await facilityNoteService.getNotes(req.params.id);
  return ApiResponse.success(res, { notes });
});

exports.createNote = asyncHandler(async (req, res) => {
  const facility = await facilityService.getFacilityById(req.params.id);
  const note = await facilityNoteService.createNote(
    req.params.id,
    req.body,
    req.user.id
  );

  await activityLogService.recordFromRequest(req, {
    context: "notes",
    action: "create_note",
    details: `Added note to facility ${facility.facilityName}`,
    facilityId: Number(req.params.id),
    companyName: facility.facilityName,
  });

  return ApiResponse.created(res, { note }, "Note created successfully");
});
