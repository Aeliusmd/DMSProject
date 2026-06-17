const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const facilityService = require("../services/facilityService");
const activityLogService = require("../services/activityLogService");

function formatManagerName(manager) {
  return (
    [manager.firstName, manager.middleName, manager.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() || "Unknown"
  );
}

function buildFacilityLogBase(req, facility) {
  return {
    facilityId: facility.id,
    companyName: facility.facilityName,
    targetEmployeeId: req.user?.id,
  };
}

async function logOfficeManagerChanges(req, before, after) {
  const base = buildFacilityLogBase(req, after);
  const beforeIds = new Set((before?.officeManagers || []).map((manager) => manager.id));
  const afterIds = new Set((after?.officeManagers || []).map((manager) => manager.id));

  for (const manager of after.officeManagers || []) {
    if (!beforeIds.has(manager.id)) {
      await activityLogService.recordFromRequest(req, {
        ...base,
        context: "facilities",
        action: "add_office_manager",
        details: `Added office manager ${formatManagerName(manager)} to ${after.facilityName}`,
      });
    }
  }

  for (const manager of before?.officeManagers || []) {
    if (!afterIds.has(manager.id)) {
      await activityLogService.recordFromRequest(req, {
        ...base,
        context: "facilities",
        action: "remove_office_manager",
        details: `Removed office manager ${formatManagerName(manager)} from ${after.facilityName}`,
      });
    }
  }
}

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
  const logBase = buildFacilityLogBase(req, facility);

  await activityLogService.recordFromRequest(req, {
    ...logBase,
    context: "facilities",
    action: "create",
    details: `Created facility ${facility.facilityName}`,
  });

  await logOfficeManagerChanges(req, { officeManagers: [] }, facility);

  return ApiResponse.created(res, { facility }, "Facility created successfully");
});

exports.update = asyncHandler(async (req, res) => {
  const before = await facilityService.getFacilityById(req.params.id);
  const facility = await facilityService.updateFacility(
    req.params.id,
    req.body,
    req.user.id
  );
  const logBase = buildFacilityLogBase(req, facility);

  await activityLogService.recordFromRequest(req, {
    ...logBase,
    context: "facilities",
    action: "update",
    details: `Updated facility ${facility.facilityName}`,
  });

  await logOfficeManagerChanges(req, before, facility);

  return ApiResponse.success(res, { facility }, "Facility updated successfully");
});

exports.remove = asyncHandler(async (req, res) => {
  const facility = await facilityService.getFacilityById(req.params.id);
  const result = await facilityService.deleteFacility(req.params.id);

  await activityLogService.recordFromRequest(req, {
    ...buildFacilityLogBase(req, facility),
    context: "facilities",
    action: "delete",
    details: `Deleted facility ${facility?.facilityName || req.params.id}`,
  });

  return ApiResponse.success(res, result, result.message);
});

exports.createDoctors = asyncHandler(async (req, res) => {
  const facility = await facilityService.getFacilityById(req.params.id);
  const doctors = await facilityService.createDoctors(
    req.params.id,
    req.body.doctors || []
  );

  await activityLogService.recordFromRequest(req, {
    ...buildFacilityLogBase(req, facility),
    context: "facilities",
    action: "create_doctors",
    details: `Added ${doctors.length} doctor(s) to ${facility.facilityName}`,
  });

  return ApiResponse.created(res, { doctors }, "Doctors created successfully");
});

exports.deactivateDoctor = asyncHandler(async (req, res) => {
  const facility = await facilityService.getFacilityById(req.params.id);
  const doctor = await facilityService.deactivateDoctor(
    req.params.id,
    req.params.doctorId
  );

  await activityLogService.recordFromRequest(req, {
    ...buildFacilityLogBase(req, facility),
    context: "facilities",
    action: "deactivate_doctor",
    details: `Deactivated doctor ${doctor.doctor} at ${facility.facilityName}`,
  });

  return ApiResponse.success(res, { doctor }, "Doctor deactivated successfully");
});

exports.reactivateDoctor = asyncHandler(async (req, res) => {
  const facility = await facilityService.getFacilityById(req.params.id);
  const doctor = await facilityService.reactivateDoctor(
    req.params.id,
    req.params.doctorId
  );

  await activityLogService.recordFromRequest(req, {
    ...buildFacilityLogBase(req, facility),
    context: "facilities",
    action: "reactivate_doctor",
    details: `Re-activated doctor ${doctor.doctor} at ${facility.facilityName}`,
  });

  return ApiResponse.success(res, { doctor }, "Doctor reactivated successfully");
});

exports.setDefaultDoctor = asyncHandler(async (req, res) => {
  const facility = await facilityService.getFacilityById(req.params.id);
  const doctor = await facilityService.setDefaultDoctor(
    req.params.id,
    req.params.doctorId
  );

  await activityLogService.recordFromRequest(req, {
    ...buildFacilityLogBase(req, facility),
    context: "facilities",
    action: "set_default_doctor",
    details: `Set ${doctor.doctor} as default doctor at ${facility.facilityName}`,
  });

  return ApiResponse.success(res, { doctor }, "Default doctor updated");
});
