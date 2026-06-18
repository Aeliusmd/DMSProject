const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const notificationService = require("../services/notificationService");

exports.getAll = asyncHandler(async (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");

  const data = await notificationService.getNotificationsForEmployee(
    req.user.id,
    req.query
  );

  return ApiResponse.success(res, data, "Notifications retrieved");
});

exports.markAsRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markNotificationAsRead(
    req.params.id,
    req.user.id
  );

  return ApiResponse.success(res, result, "Notification marked as read");
});

exports.markAllAsRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markAllNotificationsAsRead(req.user.id);

  return ApiResponse.success(res, result, "All notifications marked as read");
});
