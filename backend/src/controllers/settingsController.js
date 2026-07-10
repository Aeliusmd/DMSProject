const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const { throwIfInvalid } = require("../utils/validationUtils");
const {
  validateUpdateProfile,
  validateUpdateNotifications,
  validateChangePassword,
} = require("../validators/settingsValidator");
const settingsService = require("../services/settingsService");
const activityLogService = require("../services/activityLogService");

exports.getSettings = asyncHandler(async (req, res) => {
  const settings = await settingsService.getSettings(req.user.id);
  return ApiResponse.success(res, { settings });
});

exports.updateProfile = asyncHandler(async (req, res) => {
  throwIfInvalid(validateUpdateProfile(req.body));
  const settings = await settingsService.updateProfile(req.user.id, req.body);

  await activityLogService.recordFromRequest(req, {
    context: "employees",
    action: "update_profile",
    details: "Updated profile information",
    targetEmployeeId: req.user.id,
    companyName: "System",
  });

  return ApiResponse.success(res, { settings }, "Profile updated successfully");
});

exports.updateNotifications = asyncHandler(async (req, res) => {
  throwIfInvalid(validateUpdateNotifications(req.body));
  const settings = await settingsService.updateNotifications(
    req.user.id,
    req.body
  );

  await activityLogService.recordFromRequest(req, {
    context: "employees",
    action: "update_notifications",
    details: "Updated notification preferences",
    targetEmployeeId: req.user.id,
    companyName: "System",
  });

  return ApiResponse.success(
    res,
    { settings },
    "Notification preferences saved successfully"
  );
});

exports.changePassword = asyncHandler(async (req, res) => {
  throwIfInvalid(validateChangePassword(req.body));
  const result = await settingsService.changePassword(req.user.id, req.body);

  await activityLogService.recordFromRequest(req, {
    context: "auth",
    action: "change_password",
    details: "Changed account password",
    targetEmployeeId: req.user.id,
    companyName: "System",
  });

  return ApiResponse.success(res, result, result.message);
});
