const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const Employee = require("../models/Employee");
const employeeService = require("../services/employeeService");
const activityLogService = require("../services/activityLogService");
const notificationService = require("../services/notificationService");
const {
  validateCreateEmployee,
  validateUpdateEmployee,
  validateSuspendEmployee,
} = require("../validators/employeeValidator");
const { validateMilestoneStatsQuery } = require("../validators/queryValidators");
const { throwIfInvalid } = require("../utils/validationUtils");

exports.getAll = asyncHandler(async (req, res) => {
  const result = await employeeService.getAllEmployees(req.query);
  if (Array.isArray(result)) {
    return ApiResponse.success(res, { employees: result });
  }
  return ApiResponse.success(res, result);
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

exports.update = asyncHandler(async (req, res) => {
  const validation = validateUpdateEmployee(req.body);

  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const employee = await employeeService.updateEmployee(
    req.params.id,
    validation.data
  );

  await activityLogService.recordFromRequest(req, {
    context: "employees",
    action: "update",
    details: `Updated employee ${employee.name}`,
    targetEmployeeId: employee.id,
    companyName: "System",
  });

  await notificationService.notifyActivityEvent({
    title: "Employee Updated",
    description: `${employee.name}'s details were updated`,
    referenceType: "Employee",
    referenceId: employee.id,
  });

  return ApiResponse.success(res, { employee }, "Employee updated successfully");
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
  throwIfInvalid(validateSuspendEmployee(req.body));

  const reactivatedDate = req.body?.reactivatedDate || req.body?.reactivated_date;

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

exports.getMyMilestoneStats = asyncHandler(async (req, res) => {
  throwIfInvalid(validateMilestoneStatsQuery(req.query));
  const stats = await employeeService.getEmployeeMilestoneStats(
    req.user.id,
    {
      from: req.query.from,
      to: req.query.to,
    },
    req.user
  );

  return ApiResponse.success(res, { stats });
});

exports.getMilestoneStats = asyncHandler(async (req, res) => {
  throwIfInvalid(validateMilestoneStatsQuery(req.query));
  const stats = await employeeService.getEmployeeMilestoneStats(
    req.params.id,
    {
      from: req.query.from,
      to: req.query.to,
    },
    req.user
  );

  return ApiResponse.success(res, { stats });
});
