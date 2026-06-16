/**
 * Model layer — data access and database schemas.
 */

module.exports = {
  Employee: require("./Employee"),
  AuthSession: require("./AuthSession"),
  Facility: require("./Facility"),
  OfficeManager: require("./OfficeManager"),
  FacilityDoctor: require("./FacilityDoctor"),
  FacilityDocument: require("./FacilityDocument"),
  FacilityNote: require("./FacilityNote"),
  EmployeeSettings: require("./EmployeeSettings"),
  ActivityLog: require("./ActivityLog"),
};
