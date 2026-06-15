function getDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email || "").trim());
}

function validateFacilityPayload(data, { requirePassword = true } = {}) {
  const errors = [];

  const facilityName = data.facilityName?.trim();
  const userName = data.userName?.trim();
  const email = data.email?.trim();
  const password = data.password;
  const zipCode = data.zipCode ?? data.zip;
  const state = data.state;
  const phone = data.phone;
  const fax = data.fax;

  if (!facilityName) {
    errors.push({ field: "facilityName", message: "Facility name is required" });
  }

  if (!userName) {
    errors.push({ field: "userName", message: "User name is required" });
  }

  if (requirePassword && !password) {
    errors.push({ field: "password", message: "Password is required" });
  } else if (password && password.length < 8) {
    errors.push({
      field: "password",
      message: "Password must be at least 8 characters",
    });
  }

  if (!email) {
    errors.push({ field: "email", message: "Email is required" });
  } else if (!isValidEmail(email)) {
    errors.push({ field: "email", message: "Enter a valid email address" });
  }

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
  }

  if (!doctor.firstName?.trim() && !doctor.lastName?.trim()) {
    errors.push({
      field: `${prefix}.firstName`,
      message: "Doctor first or last name is required",
    });
  }

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
