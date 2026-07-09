function getDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email || "").trim());
}

const LIMITS = {
  facilityName: 200,
  contactName: 100,
  address: 255,
  zipCode: 20,
  city: 100,
  state: 2,
  phone: 20,
  fax: 20,
  email: 255,
  managerName: 100,
  managerPhone: 20,
  managerEmail: 255,
  doctorOfficeName: 200,
  doctorName: 100,
  doctorPhone: 20,
  doctorFax: 20,
  doctorEmail: 255,
};

function addMaxLengthError(errors, field, value, max) {
  if (value && String(value).trim().length > max) {
    errors.push({
      field,
      message: `${field.split(".").pop()} must be ${max} characters or less`,
    });
  }
}

function validateFacilityPayload(data) {
  const errors = [];

  const facilityName = data.facilityName?.trim();
  const email = data.email?.trim();
  const zipCode = data.zipCode ?? data.zip;
  const state = data.state;
  const phone = data.phone;
  const fax = data.fax;

  if (!facilityName) {
    errors.push({ field: "facilityName", message: "Facility name is required" });
  } else {
    addMaxLengthError(errors, "facilityName", facilityName, LIMITS.facilityName);
  }

  if (!email) {
    errors.push({ field: "email", message: "Email is required" });
  } else if (email.length > LIMITS.email) {
    errors.push({
      field: "email",
      message: `Email must be ${LIMITS.email} characters or less`,
    });
  } else if (!isValidEmail(email)) {
    errors.push({ field: "email", message: "Enter a valid email address" });
  }

  addMaxLengthError(errors, "firstName", data.firstName, LIMITS.contactName);
  addMaxLengthError(errors, "middleName", data.middleName, LIMITS.contactName);
  addMaxLengthError(errors, "lastName", data.lastName, LIMITS.contactName);
  addMaxLengthError(errors, "address", data.address, LIMITS.address);
  addMaxLengthError(errors, "zipCode", zipCode, LIMITS.zipCode);
  addMaxLengthError(errors, "city", data.city, LIMITS.city);
  addMaxLengthError(errors, "state", state, LIMITS.state);
  addMaxLengthError(errors, "phone", phone, LIMITS.phone);
  addMaxLengthError(errors, "fax", fax, LIMITS.fax);

  if (zipCode && getDigits(zipCode).length !== 5) {
    errors.push({ field: "zipCode", message: "ZIP must be 5 digits" });
  }

  if (state && String(state).trim().length !== 2) {
    errors.push({ field: "state", message: "State must be 2 letters" });
  }

  if (phone && getDigits(phone).length !== 10) {
    errors.push({ field: "phone", message: "Enter a valid 10 digit number" });
  }

  if (fax && getDigits(fax).length !== 10) {
    errors.push({ field: "fax", message: "Enter a valid 10 digit number" });
  }

  const managers = data.officeManagers || data.managers || [];

  managers.forEach((manager, index) => {
    addMaxLengthError(errors, `managers.${index}.firstName`, manager.firstName, LIMITS.managerName);
    addMaxLengthError(errors, `managers.${index}.middleName`, manager.middleName, LIMITS.managerName);
    addMaxLengthError(errors, `managers.${index}.lastName`, manager.lastName, LIMITS.managerName);
    addMaxLengthError(errors, `managers.${index}.phone`, manager.phone, LIMITS.managerPhone);
    addMaxLengthError(errors, `managers.${index}.email`, manager.email, LIMITS.managerEmail);

    if (manager.phone && getDigits(manager.phone).length !== 10) {
      errors.push({
        field: `managers.${index}.phone`,
        message: "Enter a valid 10 digit number",
      });
    }

    if (manager.email && !isValidEmail(manager.email)) {
      errors.push({
        field: `managers.${index}.email`,
        message: "Enter a valid email address",
      });
    }
  });

  return { valid: errors.length === 0, errors };
}

function validateDoctorPayload(doctor, index = 0) {
  const errors = [];
  const prefix = `doctors.${index}`;

  if (!doctor.officeName?.trim()) {
    errors.push({ field: `${prefix}.officeName`, message: "Office name is required" });
  } else {
    addMaxLengthError(
      errors,
      `${prefix}.officeName`,
      doctor.officeName,
      LIMITS.doctorOfficeName
    );
  }

  if (!doctor.firstName?.trim() && !doctor.lastName?.trim()) {
    errors.push({
      field: `${prefix}.firstName`,
      message: "Doctor first or last name is required",
    });
  }

  addMaxLengthError(errors, `${prefix}.firstName`, doctor.firstName, LIMITS.doctorName);
  addMaxLengthError(errors, `${prefix}.middleName`, doctor.middleName, LIMITS.doctorName);
  addMaxLengthError(errors, `${prefix}.lastName`, doctor.lastName, LIMITS.doctorName);
  addMaxLengthError(errors, `${prefix}.phone`, doctor.phone, LIMITS.doctorPhone);
  addMaxLengthError(errors, `${prefix}.fax`, doctor.fax, LIMITS.doctorFax);
  addMaxLengthError(errors, `${prefix}.email`, doctor.email, LIMITS.doctorEmail);

  if (doctor.phone && getDigits(doctor.phone).length !== 10) {
    errors.push({ field: `${prefix}.phone`, message: "Enter a valid 10 digit number" });
  }

  if (doctor.fax && getDigits(doctor.fax).length !== 10) {
    errors.push({ field: `${prefix}.fax`, message: "Enter a valid 10 digit number" });
  }

  if (doctor.email && !isValidEmail(doctor.email)) {
    errors.push({ field: `${prefix}.email`, message: "Enter a valid email address" });
  }

  return errors;
}

function validateDoctorsPayload(doctors = []) {
  const errors = doctors.flatMap((doctor, index) =>
    validateDoctorPayload(doctor, index)
  );

  return { valid: errors.length === 0, errors };
}

module.exports = {
  validateFacilityPayload,
  validateDoctorsPayload,
  getDigits,
  isValidEmail,
};
