import {
  hasFormRecordTypesSelected,
  formatSelectedRecordTypesLabel,
} from "@/lib/orders/recordTypeUtils";

export const COMPANY_ORDER_STEPS = [
  { id: 1, key: "upload", label: "Upload" },
  { id: 2, key: "verify", label: "Verify Info" },
  { id: 3, key: "payment", label: "Payment" },
  { id: 4, key: "complete", label: "Complete" },
];

export function createEmptyCompanyOrderForm() {
  return {
    facilityName: "",
    facilityAddress: "",
    facilityCity: "",
    facilityState: "",
    facilityZip: "",
    treatingDoctor: "",
    applicantName: "",
    caseName: "",
    caseNumber: "",
    recNumber: "",
    ssn: "",
    dateOfBirth: "",
    dateOfInjury: "",
    dateOfInjuryText: "",
    companyName: "",
    companyAddress: "",
    companyCity: "",
    companyState: "",
    companyZip: "",
    doctorAddress: "",
    medicalRecords: false,
    billingRecords: false,
    employmentRecords: false,
    xrays: false,
    otherRecord: false,
    type: "",
    requestedRecord: "",
    subpoenaDate: "",
    dateRequested: "",
    depoDueDate: "",
    contactEmail: "",
    contactPhone: "",
  };
}

export function mapOrderToForm(order = {}) {
  return {
    ...createEmptyCompanyOrderForm(),
    facilityName: order.facilityName || "",
    facilityAddress: order.facilityAddress || "",
    facilityCity: order.facilityCity || "",
    facilityState: order.facilityState || "",
    facilityZip: order.facilityZip || "",
    treatingDoctor: order.treatingDoctor || "",
    applicantName: order.applicantName || "",
    caseName: order.caseName || "",
    caseNumber: order.caseNumber || "",
    recNumber: order.recNumber || "",
    ssn: order.ssn || "",
    dateOfBirth: order.dateOfBirth || "",
    dateOfInjury: order.dateOfInjury || "",
    dateOfInjuryText: order.dateOfInjuryText || "",
    companyName: order.companyName || "",
    companyAddress: order.companyAddress || "",
    companyCity: order.companyCity || "",
    companyState: order.companyState || "",
    companyZip: order.companyZip || "",
    doctorAddress: order.doctorAddress || "",
    medicalRecords: Boolean(order.medicalRecords),
    billingRecords: Boolean(order.billingRecords),
    employmentRecords: Boolean(order.employmentRecords),
    xrays: Boolean(order.xrays),
    otherRecord: Boolean(order.otherRecord),
    type: order.type || "",
    requestedRecord: order.requestedRecord || "",
    subpoenaDate: order.subpoenaDate || "",
    dateRequested: order.dateRequested || "",
    depoDueDate: order.depoDueDate || "",
    contactEmail: order.contactEmail || "",
    contactPhone: order.contactPhone || "",
  };
}

export function formatFacilityAddressDisplay(form = {}) {
  const cityStateZip = [
    form.facilityCity,
    [form.facilityState, form.facilityZip].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  return [form.facilityAddress, cityStateZip].filter(Boolean).join(", ");
}

export function formatCompanyAddressDisplay(form = {}) {
  const cityStateZip = [
    form.companyCity,
    [form.companyState, form.companyZip].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  return [form.companyAddress, cityStateZip].filter(Boolean).join(", ");
}

export function validateCompanyOrderForm(form) {
  const errors = {};

  if (!`${form.facilityName || ""}`.trim()) {
    errors.facilityName = "Treating facility name is required";
  }

  if (!`${form.facilityAddress || ""}`.trim()) {
    errors.facilityAddress = "Street address is required";
  }

  if (!`${form.facilityCity || ""}`.trim()) {
    errors.facilityCity = "City is required";
  }

  const state = `${form.facilityState || ""}`.trim().toUpperCase();
  if (!state) {
    errors.facilityState = "State is required";
  } else if (!/^[A-Z]{2}$/.test(state)) {
    errors.facilityState = "State must be 2 letters";
  }

  const zipDigits = `${form.facilityZip || ""}`.replace(/\D/g, "");
  if (!zipDigits) {
    errors.facilityZip = "ZIP code is required";
  } else if (zipDigits.length !== 5 && zipDigits.length !== 9) {
    errors.facilityZip = "ZIP must be 5 digits";
  }

  if (!hasFormRecordTypesSelected(form)) {
    errors.type = "Select at least one record type";
  }

  const companyState = `${form.companyState || ""}`.trim().toUpperCase();
  if (companyState && !/^[A-Z]{2}$/.test(companyState)) {
    errors.companyState = "State must be 2 letters";
  }

  const companyZipDigits = `${form.companyZip || ""}`.replace(/\D/g, "");
  if (
    companyZipDigits &&
    companyZipDigits.length !== 5 &&
    companyZipDigits.length !== 9
  ) {
    errors.companyZip = "ZIP must be 5 digits";
  }

  return errors;
}

export function getRecordTypesSummary(form = {}) {
  return formatSelectedRecordTypesLabel(form) || "—";
}

export function formatFileSize(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1048576) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1048576).toFixed(2)} MB`;
}
