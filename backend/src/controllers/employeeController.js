const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const employeeService = require("../services/employeeService");
const { validateCreateEmployee } = require("../validators/employeeValidator");

exports.getAll = asyncHandler(async (_req, res) => {
  const employees = await employeeService.getAllEmployees();
  return ApiResponse.success(res, { employees });
});

exports.create = asyncHandler(async (req, res) => {
  const validation = validateCreateEmployee(req.body);

  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const employee = await employeeService.createEmployee(validation.data);

  return ApiResponse.created(res, { employee }, "Employee created successfully");
});

exports.terminate = asyncHandler(async (req, res) => {
  const employee = await employeeService.terminateEmployee(
    req.params.id,
    req.user.id
  );

  return ApiResponse.success(res, { employee }, "Employee terminated successfully");
});

exports.activate = asyncHandler(async (req, res) => {
  const employee = await employeeService.activateEmployee(req.params.id);

  return ApiResponse.success(res, { employee }, "Employee activated successfully");
});

exports.remove = asyncHandler(async (req, res) => {
  const result = await employeeService.deleteEmployee(
    req.params.id,
    req.user.id
  );

  return ApiResponse.success(res, result, result.message);
});
