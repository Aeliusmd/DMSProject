const asyncHandler = require("../utils/asyncHandler");
const recordDownloadService = require("../services/recordDownloadService");
const ApiResponse = require("../utils/ApiResponse");

exports.getMetadata = asyncHandler(async (req, res) => {
  const metadata = await recordDownloadService.getDownloadMetadata(
    req.params.token
  );

  return ApiResponse.success(res, metadata);
});

exports.download = asyncHandler(async (req, res) => {
  await recordDownloadService.streamDownloadByToken(req.params.token, res);
});
