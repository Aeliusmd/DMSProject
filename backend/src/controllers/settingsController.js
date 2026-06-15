const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const settingsService = require("../services/settingsService");

exports.getSettings = asyncHandler(async (req, res) => {
  const settings = await settingsService.getSettings(req.user.id);
  return ApiResponse.success(res, { settings });
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const settings = await settingsService.updateProfile(req.user.id, req.body);
  return ApiResponse.success(res, { settings }, "Profile updated successfully");
});

exports.updateNotifications = asyncHandler(async (req, res) => {
  const settings = await settingsService.updateNotifications(
    req.user.id,
    req.body
  );
  return ApiResponse.success(
    res,
    { settings },
    "Notification preferences saved successfully"
  );
});

exports.changePassword = asyncHandler(async (req, res) => {
  const result = await settingsService.changePassword(req.user.id, req.body);
  return ApiResponse.success(res, result, result.message);
});
