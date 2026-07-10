const ApiError = require("./ApiError");

function throwIfInvalid(validation) {
  if (!validation?.valid) {
    throw new ApiError(400, "Validation failed", validation?.errors || []);
  }
}

module.exports = {
  throwIfInvalid,
};
