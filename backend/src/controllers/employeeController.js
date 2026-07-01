const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const Employee = require("../models/Employee");
const employeeService = require("../services/employeeService");
const activityLogService = require("../services/activityLogService");
const notificationService = require("../services/notificationService");
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

  await notificationService.notifyActivityEvent({
    title: "New Employee Added",
    description: `${employee.name} joined with role ${employee.role}`,
    referenceType: "Employee",
    referenceId: employee.id,
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

  await notificationService.notifyActivityEvent({
    title: "Employee Terminated",
    description: `${employee.name} was terminated`,
    referenceType: "Employee",
    referenceId: employee.id,
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

  await notificationService.notifyActivityEvent({
    title: "Employee Activated",
    description: `${employee.name} was re-activated`,
    referenceType: "Employee",
    referenceId: employee.id,
  });

  return ApiResponse.success(res, { employee }, "Employee activated successfully");
});

exports.suspend = asyncHandler(async (req, res) => {
  const reactivatedDate = req.body?.reactivatedDate || req.body?.reactivated_date;

  if (!reactivatedDate) {
    throw new ApiError(400, "Reactivation date and time is required");
  }

  const employee = await employeeService.suspendEmployee(
    req.params.id,
    req.user.id,
    reactivatedDate
  );

  await activityLogService.recordFromRequest(req, {
    context: "employees",
    action: "suspend",
    details: `Suspended employee ${employee.name} until ${employee.reactivatedDate}`,
    targetEmployeeId: employee.id,
    companyName: "System",
  });

  await notificationService.notifyActivityEvent({
    title: "Employee Suspended",
    description: `${employee.name} was suspended until ${employee.reactivatedDate}`,
    referenceType: "Employee",
    referenceId: employee.id,
  });

  return ApiResponse.success(res, { employee }, "Employee suspended successfully");
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

  await notificationService.notifyActivityEvent({
    title: "Employee Deleted",
    description: `${employee?.name || req.params.id} was removed`,
    referenceType: "Employee",
    referenceId: Number(req.params.id),
  });

  return ApiResponse.success(res, result, result.message);
});
