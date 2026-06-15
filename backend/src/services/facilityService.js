const bcrypt = require("bcryptjs");
const ApiError = require("../utils/ApiError");
const { slugify } = require("../utils/slugify");
const {
  validateFacilityPayload,
  validateDoctorsPayload,
} = require("../lib/facilityValidation");
const Facility = require("../models/Facility");
const OfficeManager = require("../models/OfficeManager");
const FacilityDoctor = require("../models/FacilityDoctor");
const { getPool } = require("../config/database");

function formatDoctorName(doctor) {
  return [doctor.first_name, doctor.middle_name, doctor.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function mapManagerRow(row) {
  return {
    id: row.id,
    firstName: row.first_name || "",
    middleName: row.middle_name || "",
    lastName: row.last_name || "",
    phone: row.phone || "",
    email: row.email || "",
  };
}

function mapDoctorRow(row) {
  return {
    id: row.id,
    office: row.office_name || "",
    doctor: formatDoctorName(row),
    officeName: row.office_name || "",
    firstName: row.first_name || "",
    middleName: row.middle_name || "",
    lastName: row.last_name || "",
    phone: row.phone || "",
    fax: row.fax || "",
    email: row.email || "",
    defaultDoctor: Boolean(row.is_default),
    active: Boolean(row.is_active),
  };
}

function mapFacilityListRow(row) {
  return {
    id: row.id,
    facility: row.facility_name,
    city: row.city || "",
    zip: row.zip_code || "",
  };
}

function mapFacilityDetail(row, managers = [], doctors = []) {
  return {
    id: row.id,
    facilityName: row.facility_name,
    userName: row.user_name,
    password: "",
    firstName: row.contact_first_name || "",
    middleName: row.contact_middle_name || "",
    lastName: row.contact_last_name || "",
    address: row.address || "",
    zip: row.zip_code || "",
    zipCode: row.zip_code || "",
    city: row.city || "",
    state: row.state || "",
    phone: row.phone || "",
    fax: row.fax || "",
    email: row.email || "",
    ipAddresses: row.ip_addresses || "",
    officeManagers: managers.map(mapManagerRow),
    doctors: doctors.map(mapDoctorRow),
  };
}

function buildFacilityDbPayload(data, passwordHash = null) {
  const payload = {
    facilityName: data.facilityName?.trim(),
    slug: slugify(data.facilityName),
    userName: data.userName?.trim(),
    contactFirstName: data.firstName?.trim() || null,
    contactMiddleName: data.middleName?.trim() || null,
    contactLastName: data.lastName?.trim() || null,
    address: data.address?.trim() || null,
    zipCode: data.zipCode?.trim() || data.zip?.trim() || null,
    city: data.city?.trim() || null,
    state: data.state?.trim() || null,
    phone: data.phone?.trim() || null,
    fax: data.fax?.trim() || null,
    email: data.email?.trim() || null,
    ipAddresses: data.ipAddresses?.trim() || null,
  };

  if (passwordHash) {
    payload.passwordHash = passwordHash;
  }

  return payload;
}

function normalizeManagers(managers = []) {
  return managers
    .map((manager) => ({
      id: manager.id || null,
      firstName: manager.firstName?.trim() || "",
      middleName: manager.middleName?.trim() || "",
      lastName: manager.lastName?.trim() || "",
      phone: manager.phone?.trim() || "",
      email: manager.email?.trim() || "",
    }))
    .filter(
      (manager) =>
        manager.firstName ||
        manager.middleName ||
        manager.lastName ||
        manager.phone ||
        manager.email
    );
}

async function syncManagers(facilityId, managers, actorId) {
  const keepIds = [];

  for (const manager of managers) {
    if (manager.id) {
      await OfficeManager.update(manager.id, manager);
      keepIds.push(manager.id);
    } else {
      const pool = getPool();
      const connection = await pool.getConnection();

      try {
        const newId = await OfficeManager.create(connection, {
          facilityId,
          ...manager,
        });
        keepIds.push(newId);
      } finally {
        connection.release();
      }
    }
  }

  await OfficeManager.softDeleteMissing(facilityId, keepIds, actorId);
}

async function getAllFacilities() {
  const facilities = await Facility.findAll();
  return facilities.map(mapFacilityListRow);
}

async function getFacilityById(id) {
  const facility = await Facility.findById(id);

  if (!facility) {
    throw new ApiError(404, "Facility not found");
  }

  const managers = await OfficeManager.findByFacilityId(id);
  const doctors = await FacilityDoctor.findByFacilityId(id);

  return mapFacilityDetail(facility, managers, doctors);
}

async function createFacility(data) {
  const validation = validateFacilityPayload(data, { requirePassword: true });

  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const existingUserName = await Facility.findByUserName(data.userName.trim());

  if (existingUserName) {
    throw new ApiError(409, "A facility with this username already exists");
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  const facilityPayload = buildFacilityDbPayload(data, passwordHash);
  const managers = normalizeManagers(data.officeManagers || data.managers || []);

  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const facilityId = await Facility.create(connection, facilityPayload);

    for (const manager of managers) {
      await OfficeManager.create(connection, {
        facilityId,
        ...manager,
      });
    }

    await connection.commit();

    return getFacilityById(facilityId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateFacility(id, data, actorId) {
  const facility = await Facility.findById(id);

  if (!facility) {
    throw new ApiError(404, "Facility not found");
  }

  const validation = validateFacilityPayload(data, {
    requirePassword: false,
  });

  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const existingUserName = await Facility.findByUserName(
    data.userName.trim(),
    id
  );

  if (existingUserName) {
    throw new ApiError(409, "A facility with this username already exists");
  }

  const facilityPayload = buildFacilityDbPayload(data);

  if (data.password?.trim()) {
    facilityPayload.passwordHash = await bcrypt.hash(data.password, 10);
  }

  await Facility.update(id, facilityPayload);

  const managers = normalizeManagers(data.officeManagers || []);
  await syncManagers(id, managers, actorId);

  return getFacilityById(id);
}

async function deleteFacility(id) {
  const facility = await Facility.findById(id);

  if (!facility) {
    throw new ApiError(404, "Facility not found");
  }

  await Facility.deactivate(id);

  return { message: "Facility deleted successfully" };
}

async function createDoctors(facilityId, doctorsInput = []) {
  const facility = await Facility.findById(facilityId);

  if (!facility) {
    throw new ApiError(404, "Facility not found");
  }

  const doctors = doctorsInput
    .map((doctor) => ({
      officeName: doctor.officeName?.trim() || "",
      firstName: doctor.firstName?.trim() || "",
      middleName: doctor.middleName?.trim() || "",
      lastName: doctor.lastName?.trim() || "",
      phone: doctor.phone?.trim() || "",
      fax: doctor.fax?.trim() || "",
      email: doctor.email?.trim() || "",
      isDefault: Boolean(doctor.isDefault),
    }))
    .filter(
      (doctor) =>
        doctor.officeName ||
        doctor.firstName ||
        doctor.lastName ||
        doctor.phone ||
        doctor.fax ||
        doctor.email
    );

  if (doctors.length === 0) {
    throw new ApiError(400, "At least one doctor is required");
  }

  const validation = validateDoctorsPayload(doctors);

  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const existingDoctors = await FacilityDoctor.findByFacilityId(facilityId, {
    activeOnly: true,
  });

  const hasExistingDefault = existingDoctors.some((doctor) => doctor.is_default);
  const requestedDefaultCount = doctors.filter((doctor) => doctor.isDefault).length;

  if (requestedDefaultCount > 1) {
    throw new ApiError(400, "Only one doctor can be set as default");
  }

  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    let shouldAssignDefault = !hasExistingDefault;

    for (const doctor of doctors) {
      const makeDefault =
        doctor.isDefault || (shouldAssignDefault && requestedDefaultCount === 0);

      if (makeDefault) {
        await FacilityDoctor.clearDefaultForFacility(facilityId, connection);
        shouldAssignDefault = false;
      }

      await FacilityDoctor.create(connection, {
        facilityId,
        officeName: doctor.officeName,
        firstName: doctor.firstName,
        middleName: doctor.middleName,
        lastName: doctor.lastName,
        phone: doctor.phone,
        fax: doctor.fax,
        email: doctor.email,
        isDefault: makeDefault ? 1 : 0,
      });
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const doctorsList = await FacilityDoctor.findByFacilityId(facilityId);
  return doctorsList.map(mapDoctorRow);
}

async function deactivateDoctor(facilityId, doctorId) {
  const doctor = await FacilityDoctor.findById(doctorId, facilityId);

  if (!doctor) {
    throw new ApiError(404, "Doctor not found");
  }

  if (!doctor.is_active) {
    throw new ApiError(400, "Doctor is already inactive");
  }

  await FacilityDoctor.setActiveStatus(doctorId, facilityId, false);

  if (doctor.is_default) {
    await FacilityDoctor.clearDefaultForFacility(facilityId);
    const nextDoctor = await FacilityDoctor.getNextDefaultCandidate(
      facilityId,
      doctorId
    );

    if (nextDoctor) {
      await FacilityDoctor.setDefault(nextDoctor.id, facilityId);
    }
  }

  const updated = await FacilityDoctor.findById(doctorId, facilityId);
  return mapDoctorRow(updated);
}

async function reactivateDoctor(facilityId, doctorId) {
  const doctor = await FacilityDoctor.findById(doctorId, facilityId);

  if (!doctor) {
    throw new ApiError(404, "Doctor not found");
  }

  if (doctor.is_active) {
    throw new ApiError(400, "Doctor is already active");
  }

  await FacilityDoctor.setActiveStatus(doctorId, facilityId, true);

  const activeDoctors = await FacilityDoctor.findByFacilityId(facilityId, {
    activeOnly: true,
  });

  const hasDefault = activeDoctors.some((item) => item.is_default);

  if (!hasDefault) {
    await FacilityDoctor.setDefault(doctorId, facilityId);
  }

  const updated = await FacilityDoctor.findById(doctorId, facilityId);
  return mapDoctorRow(updated);
}

async function setDefaultDoctor(facilityId, doctorId) {
  const doctor = await FacilityDoctor.findById(doctorId, facilityId);

  if (!doctor) {
    throw new ApiError(404, "Doctor not found");
  }

  if (!doctor.is_active) {
    throw new ApiError(400, "Inactive doctors cannot be set as default");
  }

  await FacilityDoctor.setDefault(doctorId, facilityId);

  const updated = await FacilityDoctor.findById(doctorId, facilityId);
  return mapDoctorRow(updated);
}

module.exports = {
  getAllFacilities,
  getFacilityById,
  createFacility,
  updateFacility,
  deleteFacility,
  createDoctors,
  deactivateDoctor,
  reactivateDoctor,
  setDefaultDoctor,
};
