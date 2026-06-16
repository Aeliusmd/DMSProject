const ApiError = require("../utils/ApiError");
const Facility = require("../models/Facility");
const FacilityNote = require("../models/FacilityNote");
const Employee = require("../models/Employee");

function formatDisplayDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
}

function mapNoteRow(row) {
  return {
    id: row.id,
    date: formatDisplayDate(row.note_date),
    by: row.author_name || "",
    authorName: row.author_name || "",
    note: row.note || "",
    noteDate: formatDisplayDate(row.note_date),
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

async function ensureFacilityExists(facilityId) {
  const facility = await Facility.findById(facilityId);

  if (!facility) {
    throw new ApiError(404, "Facility not found");
  }

  return facility;
}

async function getNotes(facilityId) {
  await ensureFacilityExists(facilityId);

  const notes = await FacilityNote.findByFacilityId(facilityId);
  return notes.map(mapNoteRow);
}

async function createNote(facilityId, { note }, actorId) {
  await ensureFacilityExists(facilityId);

  const trimmedNote = String(note || "").trim();

  if (!trimmedNote) {
    throw new ApiError(400, "Validation failed", [
      { field: "note", message: "Note is required" },
    ]);
  }

  if (trimmedNote.length > 500) {
    throw new ApiError(400, "Validation failed", [
      { field: "note", message: "Note must be 500 characters or less" },
    ]);
  }

  const employee = await Employee.findByIdPublic(actorId);

  if (!employee) {
    throw new ApiError(404, "User not found");
  }

  const created = await FacilityNote.create({
    facilityId,
    noteDate: new Date().toISOString().slice(0, 10),
    createdBy: actorId,
    authorName: employee.name || "Unknown",
    note: trimmedNote,
  });

  return mapNoteRow(created);
}

module.exports = {
  getNotes,
  createNote,
};
