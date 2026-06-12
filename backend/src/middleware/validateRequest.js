const ApiError = require("../utils/ApiError");

/**
 * Request validation middleware placeholder.
 * Pass a validator function: (data) => ({ valid: boolean, errors?: array })
 */
function validateRequest(validator, source = "body") {
  return (req, _res, next) => {
    const result = validator(req[source]);

    if (!result.valid) {
      return next(new ApiError(400, "Validation failed", result.errors || null));
    }

    next();
  };
}

module.exports = validateRequest;
