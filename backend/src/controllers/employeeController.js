const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const Employee = require("../models/Employee");
const employeeService = require("../services/employeeService");
const activityLogService = require("../services/activityLogService");
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

  await activityLogService.recordFromRequest(req, {
    context: "employees",
    action: "create",
    details: `New employee ${employee.name} added with role ${employee.role}`,
    targetEmployeeId: employee.id,
    companyName: "System",
  });

  return ApiResponse.created(res, { employee }, "Employee created successfully");
});

exports.terminate = asyncHandler(async (req, res) => {
  const employee = await employeeService.terminateEmployee(
    req.params.id,
    req.user.id
  );

  await activityLogService.recordFromRequest(req, {
    context: "employees",
    action: "terminate",
    details: `Terminated employee ${employee.name}`,
    targetEmployeeId: employee.id,
    companyName: "System",
  });

  return ApiResponse.success(res, { employee }, "Employee terminated successfully");
});

exports.activate = asyncHandler(async (req, res) => {
  const employee = await employeeService.activateEmployee(req.params.id);

  await activityLogService.recordFromRequest(req, {
    context: "employees",
    action: "activate",
    details: `Re-activated employee ${employee.name}`,
    targetEmployeeId: employee.id,
    companyName: "System",
  });

  return ApiResponse.success(res, { employee }, "Employee activated successfully");
});

exports.remove = asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.params.id, {
    includeDeleted: true,
  });

  const result = await employeeService.deleteEmployee(
    req.params.id,
    req.user.id
  );

  await activityLogService.recordFromRequest(req, {
    context: "employees",
    action: "delete",
    details: `Deleted employee ${employee?.name || req.params.id}`,
    targetEmployeeId: Number(req.params.id),
    companyName: "System",
  });

  return ApiResponse.success(res, result, result.message);
});
