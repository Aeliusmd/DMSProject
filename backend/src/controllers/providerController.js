const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const { throwIfInvalid } = require("../utils/validationUtils");
const { validateUpdateProvider } = require("../validators/providerValidator");
const { validateSearchQuery } = require("../validators/queryValidators");
const providerService = require("../services/providerService");

exports.getAll = asyncHandler(async (_req, res) => {
  const providers = await providerService.getAllProviders();
  return ApiResponse.success(res, { providers });
});

exports.search = asyncHandler(async (req, res) => {
  throwIfInvalid(validateSearchQuery(req.query));
  const providers = await providerService.searchProviders(req.query.q);
  return ApiResponse.success(res, { providers });
});

exports.getById = asyncHandler(async (req, res) => {
  const provider = await providerService.getProviderById(req.params.id);
  return ApiResponse.success(res, { provider });
});

exports.update = asyncHandler(async (req, res) => {
  throwIfInvalid(validateUpdateProvider(req.body));
  const provider = await providerService.updateProvider(req.params.id, req.body);
  return ApiResponse.success(res, { provider });
});
