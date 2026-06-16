const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");

function notImplemented(action) {
  return asyncHandler(async (_req, _res) => {
    throw new ApiError(501, `${action} not implemented yet`);
  });
}

module.exports = { notImplemented };
