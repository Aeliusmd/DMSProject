const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const facilityService = require("../services/facilityService");

exports.getAll = asyncHandler(async (_req, res) => {
  const facilities = await facilityService.getAllFacilities();
  return ApiResponse.success(res, { facilities });
});

exports.getById = asyncHandler(async (req, res) => {
  const facility = await facilityService.getFacilityById(req.params.id);
  return ApiResponse.success(res, { facility });
});

exports.create = asyncHandler(async (req, res) => {
  const facility = await facilityService.createFacility(req.body);
  return ApiResponse.created(res, { facility }, "Facility created successfully");
});

exports.update = asyncHandler(async (req, res) => {
  const facility = await facilityService.updateFacility(
    req.params.id,
    req.body,
    req.user.id
  );
  return ApiResponse.success(res, { facility }, "Facility updated successfully");
});

exports.remove = asyncHandler(async (req, res) => {
  const result = await facilityService.deleteFacility(req.params.id);
  return ApiResponse.success(res, result, result.message);
});

exports.createDoctors = asyncHandler(async (req, res) => {
  const doctors = await facilityService.createDoctors(
    req.params.id,
    req.body.doctors || []
  );
  return ApiResponse.created(res, { doctors }, "Doctors created successfully");
});

exports.deactivateDoctor = asyncHandler(async (req, res) => {
  const doctor = await facilityService.deactivateDoctor(
    req.params.id,
    req.params.doctorId
  );
  return ApiResponse.success(res, { doctor }, "Doctor deactivated successfully");
});

exports.reactivateDoctor = asyncHandler(async (req, res) => {
  const doctor = await facilityService.reactivateDoctor(
    req.params.id,
    req.params.doctorId
  );
  return ApiResponse.success(res, { doctor }, "Doctor reactivated successfully");
});

exports.setDefaultDoctor = asyncHandler(async (req, res) => {
  const doctor = await facilityService.setDefaultDoctor(
    req.params.id,
    req.params.doctorId
  );
  return ApiResponse.success(res, { doctor }, "Default doctor updated");
});
