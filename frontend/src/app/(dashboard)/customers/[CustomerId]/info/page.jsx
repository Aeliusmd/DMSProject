"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import ConfirmModal from "@/components/ui/ConfirmModal";
import UploadDocumentsModal from "@/components/ui/UploadDocumentsModal";

const facilitiesSeed = {
  1: {
    id: 1,
    facilityName: "Smith & Associates",
    parentCompany: "Smith & Associates",
    userName: "smithassoc",
    password: "",
    firstName: "Robert",
    middleName: "James",
    lastName: "Smith",
    address: "123 Main Street Suite 400",
    zip: "90210",
    city: "Beverly Hills",
    state: "CA",
    phone: "310-555-1234",
    fax: "310-555-1235",
    email: "info@smithassoc.com",
    officeManagers: [
      {
        id: 1,
        firstName: "Linda",
        middleName: "Marie",
        lastName: "Garcia",
        phone: "310-555-1240",
        email: "lgarcia@smithassoc.com",
      },
    ],
    ipAddresses: "192.168.1.100\n192.168.1.101\n10.0.0.50",
  },
  2: {
    id: 2,
    facilityName: "Martinez Legal Group",
    parentCompany: "Martinez Legal Group",
    userName: "martinezlegal",
    password: "",
    firstName: "Linda",
    middleName: "",
    lastName: "Martinez",
    address: "450 Legal Avenue",
    zip: "90017",
    city: "Los Angeles",
    state: "CA",
    phone: "213-555-2200",
    fax: "213-555-2201",
    email: "info@martinezlegal.com",
    officeManagers: [
      {
        id: 1,
        firstName: "Carlos",
        middleName: "",
        lastName: "Diaz",
        phone: "213-555-2210",
        email: "cdiaz@martinezlegal.com",
      },
    ],
    ipAddresses: "192.168.2.10\n192.168.2.11",
  },
};

const initialDoctorItem = {
  id: 1,
  officeName: "",
  isDefault: false,
  firstName: "",
  middleName: "",
  lastName: "",
  phone: "",
  fax: "",
  email: "",
};

const doctorsSeed = [
  {
    id: 1,
    office: "Smith Medical Center",
    doctor: "David Paul Anderson",
    phone: "310-555-1300",
    fax: "310-555-1301",
    email: "danderson@smithmed.com",
    defaultDoctor: true,
    active: true,
  },
  {
    id: 2,
    office: "Beverly Hills Clinic",
    doctor: "Susan Wilson",
    phone: "310-555-1400",
    fax: "310-555-1401",
    email: "swilson@bhclinic.com",
    defaultDoctor: false,
    active: true,
  },
];

const notesSeed = [
  {
    id: 1,
    date: "2026-04-15",
    by: "John Doe",
    note: "Initial setup completed. Facility verified all contact information.",
  },
  {
    id: 2,
    date: "2026-05-01",
    by: "Sarah Johnson",
    note: "Added new doctor - Susan Wilson. Updated IP whitelist.",
  },
];

const uploadsSeed = [
  {
    id: 1,
    upload: "Business License",
    date: "2026-04-10",
    type: "PDF",
  },
  {
    id: 2,
    upload: "Insurance Certificate",
    date: "2026-04-12",
    type: "PDF",
  },
];

export default function FacilityDetailsPage() {
  const params = useParams();

  const facilityId = String(
    params?.CustomerId || params?.customerId || params?.id || "1"
  );

  const facility = facilitiesSeed[facilityId] || facilitiesSeed[1];

  const [formData, setFormData] = useState(facility);
  const [doctorInputs, setDoctorInputs] = useState([initialDoctorItem]);
  const [doctors, setDoctors] = useState(doctorsSeed);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  const [deleteDoctorModal, setDeleteDoctorModal] = useState({
    open: false,
    doctor: null,
  });

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleManagerChange = (managerId, field, value) => {
    setFormData((prev) => ({
      ...prev,
      officeManagers: prev.officeManagers.map((manager) =>
        manager.id === managerId ? { ...manager, [field]: value } : manager
      ),
    }));
  };

  const handleAddManager = () => {
    setFormData((prev) => ({
      ...prev,
      officeManagers: [
        ...prev.officeManagers,
        {
          id: Date.now(),
          firstName: "",
          middleName: "",
          lastName: "",
          phone: "",
          email: "",
        },
      ],
    }));
  };

  const handleRemoveManager = (managerId) => {
    setFormData((prev) => ({
      ...prev,
      officeManagers: prev.officeManagers.filter(
        (manager) => manager.id !== managerId
      ),
    }));
  };

  const handleDoctorInputChange = (doctorId, field, value) => {
    setDoctorInputs((prev) =>
      prev.map((doctor) =>
        doctor.id === doctorId ? { ...doctor, [field]: value } : doctor
      )
    );
  };

  const handleDoctorCheckboxChange = (doctorId, checked) => {
    setDoctorInputs((prev) =>
      prev.map((doctor) =>
        doctor.id === doctorId
          ? { ...doctor, isDefault: checked }
          : checked
          ? { ...doctor, isDefault: false }
          : doctor
      )
    );
  };

  const handleAddDoctorInput = () => {
    setDoctorInputs((prev) => [
      ...prev,
      {
        ...initialDoctorItem,
        id: Date.now(),
      },
    ]);
  };

  const handleRemoveDoctorInput = (doctorId) => {
    setDoctorInputs((prev) => prev.filter((doctor) => doctor.id !== doctorId));
  };

  const openDeleteDoctorModal = (doctor) => {
    setDeleteDoctorModal({
      open: true,
      doctor,
    });
  };

  const closeDeleteDoctorModal = () => {
    setDeleteDoctorModal({
      open: false,
      doctor: null,
    });
  };

  const handleConfirmDeleteDoctor = () => {
    if (!deleteDoctorModal.doctor) return;

    setDoctors((prev) =>
      prev.filter((doctor) => doctor.id !== deleteDoctorModal.doctor.id)
    );

    closeDeleteDoctorModal();
  };

  const handleSaveFacility = () => {
    console.log("Saved facility details:", formData);
    console.log("Doctor input sections:", doctorInputs);
  };

  const handleUploadDocuments = (uploadData) => {
    console.log("Upload documents for facility:", facilityId);
    console.log(uploadData);
  };

  return (
    <DashboardShell>
      <div className="mx-auto flex w-full max-w-[1220px] flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-[18px] font-semibold text-[#111827]">
            Facility Information
          </h1>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/customers"
              className="inline-flex h-[36px] items-center justify-center gap-2 rounded-[6px] border border-[#E2E8F0] bg-white px-4 text-[12px] font-semibold text-[#475569] shadow-sm hover:bg-[#F8FAFC]"
            >
              <ArrowLeftIcon />
              Facilities
            </Link>

            <Link
              href={`/customers/${facilityId}/users`}
              className="inline-flex h-[36px] items-center justify-center gap-2 rounded-[6px] border border-[#E2E8F0] bg-white px-4 text-[12px] font-semibold text-[#475569] shadow-sm hover:bg-[#F8FAFC]"
            >
              <UsersIcon />
              Users
            </Link>
          </div>
        </div>

        <section className="rounded-[10px] border border-[#E2E8F0] bg-white px-5 py-5 shadow-sm">
          <h2 className="mb-5 text-[13px] font-semibold text-[#111827]">
            Facility Information
          </h2>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
            <TextField
              label="Facility Name"
              name="facilityName"
              value={formData.facilityName}
              onChange={handleChange}
              required
              hint="Please leave blank spaces between numbers, names or words"
            />

            <SelectField
              label="Parent Company"
              name="parentCompany"
              value={formData.parentCompany}
              onChange={handleChange}
              options={[
                "Smith & Associates",
                "Martinez Legal Group",
                "Pacific Law Partners",
                "Williams & Co.",
              ]}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextField
              label="User Name"
              name="userName"
              value={formData.userName}
              onChange={handleChange}
              required
            />

            <TextField
              label="Password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Leave blank to keep existing"
              type="password"
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <TextField
              label="First Name"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
            />

            <TextField
              label="Middle Name"
              name="middleName"
              value={formData.middleName}
              onChange={handleChange}
            />

            <TextField
              label="Last Name"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
            />
          </div>

          <div className="mt-4">
            <TextField
              label="Facility Street Address / PO Box"
              name="address"
              value={formData.address}
              onChange={handleChange}
              hint="Please leave blank spaces between numbers, names or words"
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[110px_minmax(0,1fr)_90px]">
            <TextField
              label="Zip Code"
              name="zip"
              value={formData.zip}
              onChange={handleChange}
            />

            <TextField
              label="City"
              name="city"
              value={formData.city}
              onChange={handleChange}
            />

            <TextField
              label="State"
              name="state"
              value={formData.state}
              onChange={handleChange}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextField
              label="Phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="XXX-XXX-XXXX"
            />

            <TextField
              label="Fax"
              name="fax"
              value={formData.fax}
              onChange={handleChange}
              placeholder="XXX-XXX-XXXX"
            />
          </div>

          <div className="mt-4">
            <TextField
              label="Email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="email"
            />
          </div>

          <Divider />

          <h2 className="mb-4 text-[13px] font-semibold text-[#111827]">
            Office Managers
          </h2>

          <div className="space-y-4">
            {formData.officeManagers.map((manager, index) => (
              <OfficeManagerCard
                key={manager.id}
                manager={manager}
                index={index}
                showRemove={formData.officeManagers.length > 1}
                onChange={handleManagerChange}
                onRemove={handleRemoveManager}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddManager}
            className="mt-4 inline-flex h-[36px] items-center justify-center gap-2 rounded-[7px] border border-dashed border-[#0097B2] bg-[#E6F7FA] px-4 text-[12px] font-semibold text-[#007F96] hover:bg-[#DDF6FA]"
          >
            <PlusCircleIcon />
            Add Manager
          </button>

          <div className="mt-5">
            <TextAreaField
              label="IP Addresses"
              name="ipAddresses"
              value={formData.ipAddresses}
              onChange={handleChange}
              placeholder="WHITE LIST OF IP ADDRESSES (ONE IP ADDRESS PER LINE)"
              hint="one ip address per line"
            />
          </div>

          <button
            type="button"
            onClick={handleSaveFacility}
            className="mt-5 inline-flex h-[38px] items-center justify-center rounded-[6px] bg-[#0097B2] px-6 text-[12px] font-semibold text-white hover:bg-[#0086A0]"
          >
            Save
          </button>
        </section>

        <section className="rounded-[10px] border border-[#E2E8F0] bg-white px-5 py-5 shadow-sm">
          <h2 className="mb-5 text-[13px] font-semibold text-[#111827]">
            New Doctor
          </h2>

          <div className="space-y-4">
            {doctorInputs.map((doctor, index) => (
              <DoctorInputCard
                key={doctor.id}
                doctor={doctor}
                index={index}
                showRemove={doctorInputs.length > 1}
                onChange={handleDoctorInputChange}
                onDefaultChange={handleDoctorCheckboxChange}
                onRemove={handleRemoveDoctorInput}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddDoctorInput}
            className="mt-5 inline-flex h-[36px] items-center justify-center gap-2 rounded-[6px] border border-[#67D8E8] bg-[#E6F7FA] px-4 text-[12px] font-semibold text-[#007F96] hover:bg-[#DDF6FA]"
          >
            <PlusIcon />
            Add Doctor
          </button>
        </section>

        <DoctorsTable doctors={doctors} onDelete={openDeleteDoctorModal} />

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <NotesCard facilityId={facilityId} />
          <UploadedDocumentsCard onNewUpload={() => setUploadModalOpen(true)} />
        </div>
      </div>

      <ConfirmModal
        open={deleteDoctorModal.open}
        title="Delete Doctor"
        message={`Are you sure you want to delete ${
          deleteDoctorModal.doctor?.doctor || "this doctor"
        }? This action cannot be undone.`}
        variant="danger"
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        onCancel={closeDeleteDoctorModal}
        onConfirm={handleConfirmDeleteDoctor}
      />

      <UploadDocumentsModal
        open={uploadModalOpen}
        title="Upload Documents"
        onClose={() => setUploadModalOpen(false)}
        onUpload={handleUploadDocuments}
      />
    </DashboardShell>
  );
}

function DoctorInputCard({
  doctor,
  index,
  showRemove,
  onChange,
  onDefaultChange,
  onRemove,
}) {
  return (
    <div className="rounded-[9px] border border-[#E2E8F0] bg-white px-4 py-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-semibold text-[#64748B]">
          Doctor {index + 1}
        </h3>

        {showRemove && (
          <button
            type="button"
            onClick={() => onRemove(doctor.id)}
            className="inline-flex h-[28px] items-center justify-center gap-1 rounded-[6px] border border-red-200 bg-red-50 px-3 text-[11px] font-semibold text-red-500 hover:bg-red-100"
          >
            <TrashIcon />
            Remove
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_160px] lg:items-end">
        <TextField
          label="Office Name"
          value={doctor.officeName}
          onChange={(e) => onChange(doctor.id, "officeName", e.target.value)}
          placeholder="Office Name"
          hint="Office"
        />

        <label className="mb-[10px] flex items-center gap-2 text-[12px] text-[#475569]">
          <input
            type="checkbox"
            checked={doctor.isDefault}
            onChange={(e) => onDefaultChange(doctor.id, e.target.checked)}
            className="h-[13px] w-[13px] rounded border-[#CBD5E1] accent-[#0097B2]"
          />
          Default Doctor
        </label>
      </div>

      <p className="mt-2 text-[11px] text-[#64748B]">
        First, Middle, Last Name
      </p>

      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
        <TextField
          value={doctor.firstName}
          onChange={(e) => onChange(doctor.id, "firstName", e.target.value)}
          placeholder="First Name"
        />

        <TextField
          value={doctor.middleName}
          onChange={(e) => onChange(doctor.id, "middleName", e.target.value)}
          placeholder="Middle Name"
        />

        <TextField
          value={doctor.lastName}
          onChange={(e) => onChange(doctor.id, "lastName", e.target.value)}
          placeholder="Last Name"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField
          label="Phone"
          value={doctor.phone}
          onChange={(e) => onChange(doctor.id, "phone", e.target.value)}
          placeholder="XXX-XXX-XXXX"
        />

        <TextField
          label="Fax"
          value={doctor.fax}
          onChange={(e) => onChange(doctor.id, "fax", e.target.value)}
          placeholder="XXX-XXX-XXXX"
        />
      </div>

      <div className="mt-4">
        <TextField
          label="Email"
          value={doctor.email}
          onChange={(e) => onChange(doctor.id, "email", e.target.value)}
        />
      </div>
    </div>
  );
}

function OfficeManagerCard({
  manager,
  index,
  showRemove,
  onChange,
  onRemove,
}) {
  return (
    <div className="rounded-[9px] border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-semibold text-[#64748B]">
          Manager {index + 1}
        </h3>

        {showRemove && (
          <button
            type="button"
            onClick={() => onRemove(manager.id)}
            className="inline-flex h-[28px] items-center justify-center gap-1 rounded-[6px] border border-red-200 bg-red-50 px-3 text-[11px] font-semibold text-red-500 hover:bg-red-100"
          >
            <TrashIcon />
            Remove
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <TextField
          label="First Name"
          value={manager.firstName}
          onChange={(e) => onChange(manager.id, "firstName", e.target.value)}
        />

        <TextField
          label="Middle Name"
          value={manager.middleName}
          onChange={(e) => onChange(manager.id, "middleName", e.target.value)}
        />

        <TextField
          label="Last Name"
          value={manager.lastName}
          onChange={(e) => onChange(manager.id, "lastName", e.target.value)}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField
          label="Phone"
          value={manager.phone}
          onChange={(e) => onChange(manager.id, "phone", e.target.value)}
          placeholder="XXX-XXX-XXXX"
        />

        <TextField
          label="Email"
          value={manager.email}
          onChange={(e) => onChange(manager.id, "email", e.target.value)}
        />
      </div>
    </div>
  );
}

function DoctorsTable({ doctors, onDelete }) {
  return (
    <section className="overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white shadow-sm">
      <div className="overflow-auto">
        <table className="w-full min-w-[960px] border-collapse">
          <thead className="bg-[#F8FAFC]">
            <tr className="border-b border-[#E2E8F0] text-left text-[11px] font-semibold text-[#475569]">
              <th className="w-[60px] px-5 py-3">ID</th>
              <th className="w-[190px] px-5 py-3">Office</th>
              <th className="w-[200px] px-5 py-3">Doctor</th>
              <th className="w-[140px] px-5 py-3">Phone</th>
              <th className="w-[140px] px-5 py-3">Fax</th>
              <th className="w-[230px] px-5 py-3">Email</th>
              <th className="w-[90px] px-5 py-3 text-center">Default</th>
              <th className="w-[90px] px-5 py-3 text-center">Active</th>
              <th className="w-[100px] px-5 py-3 text-center">Delete</th>
            </tr>
          </thead>

          <tbody>
            {doctors.map((doctor, index) => (
              <tr
                key={doctor.id}
                className="border-b border-[#F1F5F9] last:border-b-0 odd:bg-white even:bg-[#F8FBFC]"
              >
                <td className="px-5 py-4 text-[12px] text-[#64748B]">
                  {index + 1}
                </td>

                <td className="px-5 py-4 text-[12px] text-[#334155]">
                  {doctor.office}
                </td>

                <td className="px-5 py-4 text-[12px] font-semibold text-[#111827]">
                  {doctor.doctor}
                </td>

                <td className="px-5 py-4 text-[12px] text-[#475569]">
                  {doctor.phone}
                </td>

                <td className="px-5 py-4 text-[12px] text-[#475569]">
                  {doctor.fax}
                </td>

                <td className="px-5 py-4 text-[12px] text-[#475569]">
                  {doctor.email}
                </td>

                <td className="px-5 py-4 text-center">
                  {doctor.defaultDoctor ? (
                    <StatusPill label="Yes" />
                  ) : (
                    <span className="text-[12px] text-[#94A3B8]">No</span>
                  )}
                </td>

                <td className="px-5 py-4 text-center">
                  <StatusPill label="Active" />
                </td>

                <td className="px-5 py-4 text-center">
                  <button
                    type="button"
                    onClick={() => onDelete(doctor)}
                    className="inline-flex h-[28px] items-center justify-center gap-2 rounded-[6px] border border-red-200 bg-red-50 px-3 text-[11px] font-semibold text-red-500 hover:bg-red-100"
                  >
                    <TrashIcon />
                    Delete
                  </button>
                </td>
              </tr>
            ))}

            {doctors.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-5 py-12 text-center text-[13px] text-[#94A3B8]"
                >
                  No doctors found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function NotesCard({ facilityId }) {
  return (
    <section className="rounded-[10px] border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-[#111827]">Notes</h2>

        <Link
          href={`/customers/${facilityId}/notes`}
          className="inline-flex h-[28px] items-center justify-center gap-1 rounded-[6px] border border-[#67D8E8] bg-[#E6F7FA] px-3 text-[11px] font-semibold text-[#007F96]"
        >
          <PlusIcon />
          New Note
        </Link>
      </div>

      <div className="overflow-auto">
        <table className="w-full min-w-[460px] border-collapse">
          <thead className="bg-[#F8FAFC]">
            <tr className="border-b border-[#E2E8F0] text-left text-[11px] font-semibold text-[#475569]">
              <th className="w-[110px] px-4 py-3">Date</th>
              <th className="w-[120px] px-4 py-3">By</th>
              <th className="px-4 py-3">Note</th>
            </tr>
          </thead>

          <tbody>
            {notesSeed.map((note) => (
              <tr
                key={note.id}
                className="border-b border-[#F1F5F9] last:border-b-0 odd:bg-white even:bg-[#F8FBFC]"
              >
                <td className="px-4 py-4 text-[12px] text-[#64748B]">
                  {note.date}
                </td>

                <td className="px-4 py-4 text-[12px] text-[#334155]">
                  {note.by}
                </td>

                <td className="px-4 py-4 text-[12px] leading-[18px] text-[#334155]">
                  {note.note}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UploadedDocumentsCard({ onNewUpload }) {
  return (
    <section className="rounded-[10px] border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-[#111827]">
          Uploaded Documents
        </h2>

        <button
          type="button"
          onClick={onNewUpload}
          className="inline-flex h-[28px] items-center justify-center gap-1 rounded-[6px] border border-[#67D8E8] bg-[#E6F7FA] px-3 text-[11px] font-semibold text-[#007F96]"
        >
          <UploadTinyIcon />
          New Upload
        </button>
      </div>

      <div className="overflow-auto">
        <table className="w-full min-w-[460px] border-collapse">
          <thead className="bg-[#F8FAFC]">
            <tr className="border-b border-[#E2E8F0] text-left text-[11px] font-semibold text-[#475569]">
              <th className="px-4 py-3">Upload</th>
              <th className="w-[120px] px-4 py-3">Date</th>
              <th className="w-[80px] px-4 py-3 text-center">Type</th>
            </tr>
          </thead>

          <tbody>
            {uploadsSeed.map((upload) => (
              <tr
                key={upload.id}
                className="border-b border-[#F1F5F9] last:border-b-0 odd:bg-white even:bg-[#F8FBFC]"
              >
                <td className="px-4 py-4">
                  <button
                    type="button"
                    className="text-[12px] font-semibold text-[#007F96] hover:underline"
                  >
                    {upload.upload}
                  </button>
                </td>

                <td className="px-4 py-4 text-[12px] text-[#64748B]">
                  {upload.date}
                </td>

                <td className="px-4 py-4 text-center">
                  <span className="inline-flex h-[24px] items-center rounded-full bg-[#F1F5F9] px-3 text-[11px] font-semibold text-[#64748B]">
                    {upload.type}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TextField({
  label,
  name,
  value,
  onChange,
  placeholder = "",
  required = false,
  hint = "",
  type = "text",
}) {
  return (
    <div className="min-w-0">
      {label && (
        <label className="mb-[6px] block text-[11px] font-medium text-[#475569]">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </label>
      )}

      <input
        type={type}
        name={name}
        value={value || ""}
        onChange={onChange}
        placeholder={placeholder}
        className="h-[38px] w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-[12px] text-[#111827] outline-none placeholder:text-[#94A3B8] focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
      />

      {hint && <p className="mt-[5px] text-[10px] text-[#94A3B8]">{hint}</p>}
    </div>
  );
}

function TextAreaField({
  label,
  name,
  value,
  onChange,
  placeholder = "",
  hint = "",
}) {
  return (
    <div>
      <label className="mb-[6px] block text-[11px] font-medium text-[#475569]">
        {label}
      </label>

      <textarea
        name={name}
        value={value || ""}
        onChange={onChange}
        placeholder={placeholder}
        rows={5}
        className="w-full resize-none rounded-[6px] border border-[#CBD5E1] bg-white px-3 py-3 text-[12px] leading-[18px] text-[#111827] outline-none placeholder:text-[#94A3B8] focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
      />

      {hint && <p className="mt-[5px] text-[10px] text-[#94A3B8]">{hint}</p>}
    </div>
  );
}

function SelectField({ label, name, value, onChange, options }) {
  return (
    <div>
      <label className="mb-[6px] block text-[11px] font-medium text-[#475569]">
        {label}
      </label>

      <select
        name={name}
        value={value || ""}
        onChange={onChange}
        className="h-[38px] w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-[12px] text-[#111827] outline-none focus:border-[#0097B2] focus:ring-2 focus:ring-[#0097B2]/10"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function StatusPill({ label }) {
  return (
    <span className="inline-flex h-[24px] items-center rounded-full bg-[#ECFDF5] px-3 text-[11px] font-semibold text-[#059669]">
      {label}
    </span>
  );
}

function Divider() {
  return <div className="my-5 h-px w-full bg-[#E2E8F0]" />;
}

function ArrowLeftIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path
        d="M19 12H5M11 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path
        d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlusCircleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 8v8M8 12h8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UploadTinyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 16V5M8 9l4-4 4 4M5 19h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}