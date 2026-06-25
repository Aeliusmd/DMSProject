"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import ConfirmModal from "@/components/ui/ConfirmModal";
import AlertModal from "@/components/ui/AlertModal";
import UploadDocumentsModal from "@/components/ui/UploadDocumentsModal";
import DocumentPreviewModal from "@/components/facilities/DocumentPreviewModal";
import { ApiRequestError } from "@/lib/auth/authApi";
import {
  createDoctors,
  deactivateDoctor,
  deleteFacilityDocument,
  getFacility,
  getFacilityDocuments,
  getFacilityNotes,
  reactivateDoctor,
  setDefaultDoctor,
  updateFacility,
  uploadFacilityDocument,
} from "@/lib/facilities/facilityApi";

const createEmptyDoctorInput = (id) => ({
  id,
  officeName: "",
  isDefault: false,
  firstName: "",
  middleName: "",
  lastName: "",
  phone: "",
  fax: "",
  email: "",
});

export default function FacilityDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const facilityId = String(
    params?.facilityId || params?.FacilityId || params?.id || ""
  );

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [formData, setFormData] = useState(null);
  const [doctorInputs, setDoctorInputs] = useState([
    createEmptyDoctorInput("doctor-input-1"),
  ]);
  const [doctors, setDoctors] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [uploadDocError, setUploadDocError] = useState("");
  const [previewDocument, setPreviewDocument] = useState(null);
  const [uploadAlert, setUploadAlert] = useState({
    open: false,
    variant: "success",
    title: "",
    message: "",
  });
  const [deleteDocumentModal, setDeleteDocumentModal] = useState({
    open: false,
    document: null,
  });
  const [deletingDocument, setDeletingDocument] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creatingDoctors, setCreatingDoctors] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [doctorError, setDoctorError] = useState("");
  const [doctorErrors, setDoctorErrors] = useState({});
  const [doctorSubmitAttempted, setDoctorSubmitAttempted] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState(null);

  const [saveConfirmModal, setSaveConfirmModal] = useState({ open: false });

  const [removeManagerModal, setRemoveManagerModal] = useState({
    open: false,
    manager: null,
  });

  const [deleteDoctorModal, setDeleteDoctorModal] = useState({
    open: false,
    doctor: null,
  });

  const loadDocuments = useCallback(async () => {
    if (!facilityId) return;

    setDocumentsLoading(true);

    try {
      const data = await getFacilityDocuments(facilityId);
      setDocuments(data);
    } catch (err) {
      setSubmitError(err.message || "Failed to load documents");
    } finally {
      setDocumentsLoading(false);
    }
  }, [facilityId]);

  const loadNotes = useCallback(async () => {
    if (!facilityId) return;

    setNotesLoading(true);

    try {
      const data = await getFacilityNotes(facilityId);
      setNotes(data);
    } catch (err) {
      setSubmitError(err.message || "Failed to load notes");
    } finally {
      setNotesLoading(false);
    }
  }, [facilityId]);

  const loadFacility = useCallback(async () => {
    if (!facilityId) return;

    setLoading(true);
    setLoadError("");

    try {
      const facility = await getFacility(facilityId);

      const nextFormData = {
        ...facility,
        zip: facility.zip || facility.zipCode || "",
        officeManagers:
          facility.officeManagers?.length > 0
            ? facility.officeManagers
            : [
                {
                  id: null,
                  firstName: "",
                  middleName: "",
                  lastName: "",
                  phone: "",
                  email: "",
                },
              ],
      };

      setFormData(nextFormData);
      setSavedSnapshot(normalizeFacilityFormData(nextFormData));
      setDoctors(facility.doctors || []);
    } catch (err) {
      setLoadError(err.message || "Failed to load facility");
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  useEffect(() => {
    loadFacility();
  }, [loadFacility]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    let nextValue = value;

    if (name === "phone" || name === "fax") {
      nextValue = formatPhone(value);
    }

    if (name === "zip") {
      nextValue = value.replace(/\D/g, "").slice(0, 5);
    }

    if (name === "state") {
      nextValue = value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 2);
    }

    setFormData((prev) => ({
      ...prev,
      [name]: nextValue,
    }));

    if (submitAttempted) {
      const fieldError = validateFacilityField(name, nextValue);

      setErrors((prev) => {
        const nextErrors = { ...prev };

        if (fieldError) {
          nextErrors[name] = fieldError;
        } else {
          delete nextErrors[name];
        }

        return nextErrors;
      });
    }
  };

  const handleManagerChange = (managerId, field, value) => {
    let nextValue = value;

    if (field === "phone") {
      nextValue = formatPhone(value);
    }

    setFormData((prev) => ({
      ...prev,
      officeManagers: prev.officeManagers.map((manager) =>
        manager.id === managerId ? { ...manager, [field]: nextValue } : manager
      ),
    }));
  };

  const handleAddManager = () => {
    setFormData((prev) => ({
      ...prev,
      officeManagers: [
        ...prev.officeManagers,
        {
          id: `new-${Date.now()}`,
          firstName: "",
          middleName: "",
          lastName: "",
          phone: "",
          email: "",
        },
      ],
    }));
  };

  const openRemoveManagerModal = (manager) => {
    setRemoveManagerModal({
      open: true,
      manager,
    });
  };

  const closeRemoveManagerModal = () => {
    setRemoveManagerModal({
      open: false,
      manager: null,
    });
  };

  const handleRemoveManager = (manager) => {
    openRemoveManagerModal(manager);
  };

  const persistFacilityUpdate = async (data) => {
    const officeManagers = data.officeManagers.map((manager) => ({
      id: typeof manager.id === "number" ? manager.id : null,
      firstName: manager.firstName,
      middleName: manager.middleName,
      lastName: manager.lastName,
      phone: manager.phone,
      email: manager.email,
    }));

    const updated = await updateFacility(facilityId, {
      facilityName: data.facilityName,
      firstName: data.firstName,
      middleName: data.middleName,
      lastName: data.lastName,
      address: data.address,
      zipCode: data.zip,
      city: data.city,
      state: data.state,
      phone: data.phone,
      fax: data.fax,
      email: data.email,
      ipAddresses: data.ipAddresses,
      officeManagers,
    });

    const nextFormData = {
      ...updated,
      zip: updated.zip || updated.zipCode || "",
    };

    setFormData(nextFormData);
    setSavedSnapshot(normalizeFacilityFormData(nextFormData));

    return nextFormData;
  };

  const handleConfirmRemoveManager = async () => {
    const manager = removeManagerModal.manager;

    if (!manager || !formData) return;

    const updatedManagers = formData.officeManagers.filter(
      (item) => item.id !== manager.id
    );

    const nextFormData = {
      ...formData,
      officeManagers:
        updatedManagers.length > 0
          ? updatedManagers
          : [
              {
                id: null,
                firstName: "",
                middleName: "",
                lastName: "",
                phone: "",
                email: "",
              },
            ],
    };

    if (typeof manager.id === "number") {
      setSaving(true);
      setSubmitError("");

      try {
        await persistFacilityUpdate(nextFormData);
      } catch (err) {
        setSubmitError(err.message || "Failed to remove office manager");
      } finally {
        setSaving(false);
        closeRemoveManagerModal();
      }

      return;
    }

    setFormData(nextFormData);
    closeRemoveManagerModal();
  };

  const handleDoctorInputChange = (doctorId, field, value) => {
    let nextValue = value;

    if (field === "phone" || field === "fax") {
      nextValue = formatPhone(value);
    }

    setDoctorInputs((prev) =>
      prev.map((doctor) =>
        doctor.id === doctorId ? { ...doctor, [field]: nextValue } : doctor
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
      createEmptyDoctorInput(`doctor-input-${Date.now()}`),
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

  const handleConfirmDeleteDoctor = async () => {
    if (!deleteDoctorModal.doctor) return;

    try {
      const updated = await deactivateDoctor(
        facilityId,
        deleteDoctorModal.doctor.id
      );

      setDoctors((prev) =>
        prev.map((doctor) =>
          doctor.id === updated.id ? updated : doctor
        )
      );

      const refreshed = await getFacility(facilityId);
      setDoctors(refreshed.doctors || []);
    } catch (err) {
      setSubmitError(err.message || "Failed to deactivate doctor");
    } finally {
      closeDeleteDoctorModal();
    }
  };

  const handleReactivateDoctor = async (doctor) => {
    try {
      await reactivateDoctor(facilityId, doctor.id);
      const refreshed = await getFacility(facilityId);
      setDoctors(refreshed.doctors || []);
    } catch (err) {
      setSubmitError(err.message || "Failed to reactivate doctor");
    }
  };

  const handleSetDefaultDoctor = async (doctor) => {
    try {
      await setDefaultDoctor(facilityId, doctor.id);
      const refreshed = await getFacility(facilityId);
      setDoctors(refreshed.doctors || []);
    } catch (err) {
      setSubmitError(err.message || "Failed to set default doctor");
    }
  };

  const handleSaveFacility = () => {
    if (!formData) return;

    setSubmitAttempted(true);
    setSubmitError("");

    const validationErrors = validateFacilityForm(formData);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

    if (!hasFacilityChanges(formData, savedSnapshot)) return;

    setSaveConfirmModal({ open: true });
  };

  const closeSaveConfirmModal = () => {
    setSaveConfirmModal({ open: false });
  };

  const confirmSaveFacility = async () => {
    if (!formData) return;

    closeSaveConfirmModal();
    setSaving(true);
    setSubmitError("");

    try {
      await persistFacilityUpdate(formData);
      router.push("/facilities");
    } catch (err) {
      if (err instanceof ApiRequestError && err.errors) {
        setErrors(mapApiErrors(err.errors));
      }
      setSubmitError(err.message || "Failed to update facility");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateDoctors = async () => {
    setDoctorSubmitAttempted(true);
    setDoctorError("");

    const doctorsToCreate = doctorInputs
      .map(({ officeName, firstName, middleName, lastName, phone, fax, email, isDefault }) => ({
        officeName,
        firstName,
        middleName,
        lastName,
        phone,
        fax,
        email,
        isDefault,
      }))
      .filter(
        (doctor) =>
          doctor.officeName?.trim() ||
          doctor.firstName?.trim() ||
          doctor.lastName?.trim() ||
          doctor.phone?.trim() ||
          doctor.fax?.trim() ||
          doctor.email?.trim()
      );

    if (doctorsToCreate.length === 0) {
      setDoctorError("Add at least one doctor with details");
      return;
    }

    const validationErrors = validateDoctorsForm(doctorsToCreate);
    setDoctorErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

    setCreatingDoctors(true);

    try {
      const created = await createDoctors(facilityId, doctorsToCreate);
      setDoctors(created);
      setDoctorInputs([createEmptyDoctorInput(`doctor-input-${Date.now()}`)]);
      setDoctorSubmitAttempted(false);
      setDoctorErrors({});
    } catch (err) {
      if (err instanceof ApiRequestError && err.errors) {
        setDoctorErrors(mapApiErrors(err.errors));
      }
      setDoctorError(err.message || "Failed to create doctors");
    } finally {
      setCreatingDoctors(false);
    }
  };

  const getError = (field) => {
    if (!submitAttempted) return "";
    return errors[field] || "";
  };

  const getDoctorInputError = (index, field) => {
    if (!doctorSubmitAttempted) return "";
    return doctorErrors[`doctors.${index}.${field}`] || "";
  };

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex min-h-[calc(100vh-92px)] items-center justify-center text-[13px] text-[#64748B]">
          Loading facility...
        </div>
      </DashboardShell>
    );
  }

  if (loadError || !formData) {
    return (
      <DashboardShell>
        <div className="flex min-h-[calc(100vh-92px)] flex-col items-center justify-center gap-4">
          <p className="text-[13px] font-semibold text-red-600">{loadError || "Facility not found"}</p>
          <Link
            href="/facilities"
            className="text-[12px] font-semibold text-[#007F96] hover:underline"
          >
            Back to Facilities
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const handleUploadDocuments = async ({ documentType, files }) => {
    if (!files?.length) return;

    setUploadingDocument(true);
    setUploadDocError("");

    try {
      for (const file of files) {
        await uploadFacilityDocument(facilityId, file, documentType);
      }

      await loadDocuments();
      setUploadModalOpen(false);
      setUploadDocError("");
      setUploadAlert({
        open: true,
        variant: "success",
        title: "Upload Successful",
        message:
          files.length > 1
            ? `${files.length} documents were uploaded successfully.`
            : "Document was uploaded successfully.",
      });
    } catch (err) {
      const message = err.message || "Failed to upload document";
      setUploadDocError(message);
      setUploadAlert({
        open: true,
        variant: "error",
        title: "Upload Failed",
        message,
      });
      throw err;
    } finally {
      setUploadingDocument(false);
    }
  };

  const openDeleteDocumentModal = (document) => {
    setDeleteDocumentModal({
      open: true,
      document,
    });
  };

  const closeDeleteDocumentModal = () => {
    if (deletingDocument) return;

    setDeleteDocumentModal({
      open: false,
      document: null,
    });
  };

  const handleConfirmDeleteDocument = async () => {
    if (!deleteDocumentModal.document) return;

    setDeletingDocument(true);

    try {
      await deleteFacilityDocument(facilityId, deleteDocumentModal.document.id);

      if (previewDocument?.id === deleteDocumentModal.document.id) {
        setPreviewDocument(null);
      }

      await loadDocuments();
      setUploadAlert({
        open: true,
        variant: "success",
        title: "Document Deleted",
        message: "The document was deleted successfully.",
      });
    } catch (err) {
      setUploadAlert({
        open: true,
        variant: "error",
        title: "Delete Failed",
        message: err.message || "Failed to delete document",
      });
    } finally {
      setDeletingDocument(false);
      setDeleteDocumentModal({
        open: false,
        document: null,
      });
    }
  };

  const openUploadModal = () => {
    setUploadDocError("");
    setUploadModalOpen(true);
  };

  const closeUploadModal = () => {
    if (uploadingDocument) return;
    setUploadModalOpen(false);
    setUploadDocError("");
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
              href="/facilities"
              className="inline-flex h-[36px] items-center justify-center gap-2 rounded-[6px] border border-[#E2E8F0] bg-white px-4 text-[12px] font-semibold text-[#475569] shadow-sm hover:bg-[#F8FAFC]"
            >
              <ArrowLeftIcon />
              Facilities
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
              error={getError("facilityName")}
              hint="Please leave blank spaces between numbers, names or words"
            />

            {/* <SelectField
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
            /> */}
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
              error={getError("zipCode")}
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
              error={getError("state")}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextField
              label="Phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="XXX-XXX-XXXX"
              error={getError("phone")}
            />

            <TextField
              label="Fax"
              name="fax"
              value={formData.fax}
              onChange={handleChange}
              placeholder="XXX-XXX-XXXX"
              error={getError("fax")}
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
              error={getError("email")}
            />
          </div>

          <Divider />

          <h2 className="mb-4 text-[13px] font-semibold text-[#111827]">
            Office Managers
          </h2>

          <div className="space-y-4">
            {formData.officeManagers.map((manager, index) => (
              <OfficeManagerCard
                key={manager.id ?? `manager-${index}`}
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

          {submitError && (
            <div className="mt-4 rounded-[7px] border border-red-200 bg-red-50 px-3 py-3 text-[12px] font-semibold text-red-600">
              {submitError}
            </div>
          )}

          <button
            type="button"
            onClick={handleSaveFacility}
            disabled={saving}
            className="mt-5 inline-flex h-[38px] items-center justify-center rounded-[6px] bg-[#0097B2] px-6 text-[12px] font-semibold text-white hover:bg-[#0086A0] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
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
                getError={(field) => getDoctorInputError(index, field)}
              />
            ))}
          </div>

          {doctorError && (
            <div className="mt-4 rounded-[7px] border border-red-200 bg-red-50 px-3 py-3 text-[12px] font-semibold text-red-600">
              {doctorError}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleAddDoctorInput}
              className="inline-flex h-[36px] items-center justify-center gap-2 rounded-[6px] border border-[#67D8E8] bg-[#E6F7FA] px-4 text-[12px] font-semibold text-[#007F96] hover:bg-[#DDF6FA]"
            >
              <PlusIcon />
              Add Doctor
            </button>

            <button
              type="button"
              onClick={handleCreateDoctors}
              disabled={creatingDoctors}
              className="inline-flex h-[36px] items-center justify-center rounded-[6px] bg-[#0097B2] px-5 text-[12px] font-semibold text-white hover:bg-[#0086A0] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creatingDoctors ? "Creating..." : "Create Doctors"}
            </button>
          </div>
        </section>

        <DoctorsTable
          doctors={doctors}
          onDelete={openDeleteDoctorModal}
          onReactivate={handleReactivateDoctor}
          onSetDefault={handleSetDefaultDoctor}
        />

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <NotesCard
            facilityId={facilityId}
            notes={notes}
            loading={notesLoading}
          />
          <UploadedDocumentsCard
            documents={documents}
            loading={documentsLoading}
            onNewUpload={openUploadModal}
            onSelectDocument={setPreviewDocument}
            onDeleteDocument={openDeleteDocumentModal}
          />
        </div>
      </div>

      <ConfirmModal
        open={saveConfirmModal.open}
        title="Save Changes"
        message="Save the updated facility details?"
        variant="warning"
        confirmLabel="Yes"
        cancelLabel="No"
        onCancel={closeSaveConfirmModal}
        onConfirm={confirmSaveFacility}
      />

      <ConfirmModal
        open={removeManagerModal.open}
        title="Remove Office Manager"
        message={`Remove ${formatManagerName(
          removeManagerModal.manager
        )} from this facility?`}
        variant="danger"
        confirmLabel="Remove"
        cancelLabel="No"
        onCancel={closeRemoveManagerModal}
        onConfirm={handleConfirmRemoveManager}
      />

      <ConfirmModal
        open={deleteDoctorModal.open}
        title="Deactivate Doctor"
        message={`Are you sure you want to deactivate ${
          deleteDoctorModal.doctor?.doctor || "this doctor"
        }?`}
        variant="danger"
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        onCancel={closeDeleteDoctorModal}
        onConfirm={handleConfirmDeleteDoctor}
      />

      <ConfirmModal
        open={deleteDocumentModal.open}
        title="Delete Document"
        message={`Are you sure you want to delete ${
          deleteDocumentModal.document?.documentName ||
          deleteDocumentModal.document?.name ||
          "this document"
        }?`}
        variant="danger"
        confirmLabel="Yes"
        cancelLabel="No"
        onCancel={closeDeleteDocumentModal}
        onConfirm={handleConfirmDeleteDocument}
      />

      <AlertModal
        open={uploadAlert.open}
        title={uploadAlert.title}
        message={uploadAlert.message}
        variant={uploadAlert.variant}
        onClose={() => setUploadAlert((prev) => ({ ...prev, open: false }))}
      />

      <UploadDocumentsModal
        open={uploadModalOpen}
        title="Upload Documents"
        onClose={closeUploadModal}
        onUpload={handleUploadDocuments}
        uploading={uploadingDocument}
        uploadError={uploadDocError}
      />

      <DocumentPreviewModal
        open={Boolean(previewDocument)}
        facilityId={facilityId}
        selectedDocument={previewDocument}
        onClose={() => setPreviewDocument(null)}
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
  getError,
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
          error={getError?.("officeName")}
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
          error={getError?.("firstName")}
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
          error={getError?.("phone")}
        />

        <TextField
          label="Fax"
          value={doctor.fax}
          onChange={(e) => onChange(doctor.id, "fax", e.target.value)}
          placeholder="XXX-XXX-XXXX"
          error={getError?.("fax")}
        />
      </div>

      <div className="mt-4">
        <TextField
          label="Email"
          value={doctor.email}
          onChange={(e) => onChange(doctor.id, "email", e.target.value)}
          error={getError?.("email")}
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
            onClick={() => onRemove(manager)}
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

function DoctorsTable({ doctors, onDelete, onReactivate, onSetDefault }) {
  return (
    <section className="overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white shadow-sm">
      <div className="overflow-auto">
        <table className="w-full min-w-[1060px] border-collapse">
          <thead className="bg-[#F8FAFC]">
            <tr className="border-b border-[#E2E8F0] text-left text-[11px] font-semibold text-[#475569]">
              <th className="w-[60px] px-5 py-3">ID</th>
              <th className="w-[190px] px-5 py-3">Office</th>
              <th className="w-[200px] px-5 py-3">Doctor</th>
              <th className="w-[140px] px-5 py-3">Phone</th>
              <th className="w-[140px] px-5 py-3">Fax</th>
              <th className="w-[230px] px-5 py-3">Email</th>
              <th className="w-[110px] px-5 py-3 text-center">Default</th>
              <th className="w-[90px] px-5 py-3 text-center">Active</th>
              <th className="w-[140px] px-5 py-3 text-center">Actions</th>
            </tr>
          </thead>

          <tbody>
            {doctors.map((doctor) => (
              <tr
                key={doctor.id}
                className="border-b border-[#F1F5F9] last:border-b-0 odd:bg-white even:bg-[#F8FBFC]"
              >
                <td className="px-5 py-4 text-[12px] text-[#64748B]">
                  {doctor.id}
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
                  ) : doctor.active ? (
                    <button
                      type="button"
                      onClick={() => onSetDefault(doctor)}
                      className="text-[11px] font-semibold text-[#007F96] hover:underline"
                    >
                      Set Default
                    </button>
                  ) : (
                    <span className="text-[12px] text-[#94A3B8]">No</span>
                  )}
                </td>

                <td className="px-5 py-4 text-center">
                  {doctor.active ? (
                    <StatusPill label="Active" />
                  ) : (
                    <InactivePill />
                  )}
                </td>

                <td className="px-5 py-4 text-center">
                  {doctor.active ? (
                    <button
                      type="button"
                      onClick={() => onDelete(doctor)}
                      className="inline-flex h-[28px] items-center justify-center gap-2 rounded-[6px] border border-red-200 bg-red-50 px-3 text-[11px] font-semibold text-red-500 hover:bg-red-100"
                    >
                      <TrashIcon />
                      Delete
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onReactivate(doctor)}
                      className="inline-flex h-[28px] items-center justify-center gap-2 rounded-[6px] border border-[#67D8E8] bg-[#E6F7FA] px-3 text-[11px] font-semibold text-[#007F96] hover:bg-[#DDF6FA]"
                    >
                      Reactivate
                    </button>
                  )}
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

function NotesCard({ facilityId, notes, loading }) {
  return (
    <section className="rounded-[10px] border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-[#111827]">Notes</h2>

        <Link
          href={`/facilities/${facilityId}/notes`}
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
            {loading && (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-8 text-center text-[12px] text-[#94A3B8]"
                >
                  Loading notes...
                </td>
              </tr>
            )}

            {!loading &&
              notes.map((note) => (
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

            {!loading && notes.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-8 text-center text-[12px] text-[#94A3B8]"
                >
                  No notes found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UploadedDocumentsCard({
  documents,
  loading,
  onNewUpload,
  onSelectDocument,
  onDeleteDocument,
}) {
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
        <table className="w-full min-w-[640px] border-collapse">
          <thead className="bg-[#F8FAFC]">
            <tr className="border-b border-[#E2E8F0] text-left text-[11px] font-semibold text-[#475569]">
              <th className="px-4 py-3">Document</th>
              <th className="w-[120px] px-4 py-3">Date</th>
              <th className="w-[120px] px-4 py-3 text-center">Document Type</th>
              <th className="w-[80px] px-4 py-3 text-center">File Type</th>
              <th className="w-[90px] px-4 py-3 text-center">Delete</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-[12px] text-[#94A3B8]"
                >
                  Loading documents...
                </td>
              </tr>
            )}

            {!loading &&
              documents.map((upload) => (
                <tr
                  key={upload.id}
                  className="border-b border-[#F1F5F9] last:border-b-0 odd:bg-white even:bg-[#F8FBFC]"
                >
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={() => onSelectDocument(upload)}
                      className="text-left text-[12px] font-semibold text-[#007F96] hover:underline"
                    >
                      {upload.documentName || upload.name}
                    </button>
                  </td>

                  <td className="px-4 py-4 text-[12px] text-[#64748B]">
                    {upload.date}
                  </td>

                  <td className="px-4 py-4 text-center">
                    <span className="inline-flex h-[24px] items-center rounded-full bg-[#E6F7FA] px-3 text-[11px] font-semibold text-[#007F96]">
                      {upload.documentType}
                    </span>
                  </td>

                  <td className="px-4 py-4 text-center">
                    <span className="inline-flex h-[24px] items-center rounded-full bg-[#F1F5F9] px-3 text-[11px] font-semibold text-[#64748B]">
                      {upload.fileType}
                    </span>
                  </td>

                  <td className="px-4 py-4 text-center">
                    <button
                      type="button"
                      onClick={() => onDeleteDocument(upload)}
                      className="inline-flex h-[28px] items-center justify-center gap-1 rounded-[6px] border border-red-200 bg-red-50 px-3 text-[11px] font-semibold text-red-500 hover:bg-red-100"
                    >
                      <TrashIcon />
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

            {!loading && documents.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-[12px] text-[#94A3B8]"
                >
                  No documents uploaded yet.
                </td>
              </tr>
            )}
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
  error = "",
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
        className={`h-[38px] w-full rounded-[6px] border bg-white px-3 text-[12px] text-[#111827] outline-none placeholder:text-[#94A3B8] focus:ring-2 ${
          error
            ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
            : "border-[#CBD5E1] focus:border-[#0097B2] focus:ring-[#0097B2]/10"
        }`}
      />

      <div className="mt-[5px] min-h-[15px]">
        {error ? (
          <p className="text-[11px] font-medium text-red-500">{error}</p>
        ) : hint ? (
          <p className="text-[10px] text-[#94A3B8]">{hint}</p>
        ) : null}
      </div>
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

function InactivePill() {
  return (
    <span className="inline-flex h-[24px] items-center rounded-full bg-[#FEF2F2] px-3 text-[11px] font-semibold text-[#DC2626]">
      Inactive
    </span>
  );
}

function mapApiErrors(errors) {
  const mapped = {};

  errors.forEach(({ field, message }) => {
    mapped[field] = message;
  });

  return mapped;
}

function normalizeFacilityFormData(data) {
  return {
    facilityName: data.facilityName?.trim() || "",
    firstName: data.firstName?.trim() || "",
    middleName: data.middleName?.trim() || "",
    lastName: data.lastName?.trim() || "",
    address: data.address?.trim() || "",
    zip: (data.zip || data.zipCode || "").trim(),
    city: data.city?.trim() || "",
    state: data.state?.trim() || "",
    phone: data.phone?.trim() || "",
    fax: data.fax?.trim() || "",
    email: data.email?.trim() || "",
    ipAddresses: data.ipAddresses?.trim() || "",
    officeManagers: (data.officeManagers || []).map((manager) => ({
      id: typeof manager.id === "number" ? manager.id : null,
      firstName: manager.firstName?.trim() || "",
      middleName: manager.middleName?.trim() || "",
      lastName: manager.lastName?.trim() || "",
      phone: manager.phone?.trim() || "",
      email: manager.email?.trim() || "",
    })),
  };
}

function hasFacilityChanges(formData, savedSnapshot) {
  if (!savedSnapshot) return true;

  return (
    JSON.stringify(normalizeFacilityFormData(formData)) !==
    JSON.stringify(savedSnapshot)
  );
}

function formatManagerName(manager) {
  if (!manager) return "this office manager";

  const name = [manager.firstName, manager.middleName, manager.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return name || "this office manager";
}

function validateFacilityForm(data) {
  const errors = {};

  if (!data.facilityName?.trim()) {
    errors.facilityName = "Facility name is required";
  }

  if (!data.email?.trim()) {
    errors.email = "Email is required";
  } else if (!isValidEmail(data.email)) {
    errors.email = "Enter a valid email address";
  }

  if (data.zip && getDigits(data.zip).length !== 5) {
    errors.zipCode = "ZIP must be 5 digits";
  }

  if (data.state && data.state.length !== 2) {
    errors.state = "State must be 2 letters";
  }

  if (data.phone && getDigits(data.phone).length !== 10) {
    errors.phone = "Enter a valid 10 digit number";
  }

  if (data.fax && getDigits(data.fax).length !== 10) {
    errors.fax = "Enter a valid 10 digit number";
  }

  (data.officeManagers || []).forEach((manager, index) => {
    if (manager.phone && getDigits(manager.phone).length !== 10) {
      errors[`managers.${index}.phone`] = "Enter a valid 10 digit number";
    }

    if (manager.email && !isValidEmail(manager.email)) {
      errors[`managers.${index}.email`] = "Enter a valid email address";
    }
  });

  return errors;
}

function validateFacilityField(field, value) {
  if (!value?.trim()) {
    if (field === "facilityName") return "Facility name is required";
    if (field === "email") return "Email is required";
  }

  if (field === "email" && value && !isValidEmail(value)) {
    return "Enter a valid email address";
  }

  if (field === "zip" && value && getDigits(value).length !== 5) {
    return "ZIP must be 5 digits";
  }

  if (field === "state" && value && value.length !== 2) {
    return "State must be 2 letters";
  }

  if ((field === "phone" || field === "fax") && value) {
    if (getDigits(value).length !== 10) return "Enter a valid 10 digit number";
  }

  return "";
}

function validateDoctorsForm(doctors) {
  const errors = {};

  doctors.forEach((doctor, index) => {
    if (!doctor.officeName?.trim()) {
      errors[`doctors.${index}.officeName`] = "Office name is required";
    }

    if (!doctor.firstName?.trim() && !doctor.lastName?.trim()) {
      errors[`doctors.${index}.firstName`] =
        "Doctor first or last name is required";
    }

    if (doctor.phone && getDigits(doctor.phone).length !== 10) {
      errors[`doctors.${index}.phone`] = "Enter a valid 10 digit number";
    }

    if (doctor.fax && getDigits(doctor.fax).length !== 10) {
      errors[`doctors.${index}.fax`] = "Enter a valid 10 digit number";
    }

    if (doctor.email && !isValidEmail(doctor.email)) {
      errors[`doctors.${index}.email`] = "Enter a valid email address";
    }
  });

  return errors;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

function getDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function formatPhone(value) {
  const digits = getDigits(value).slice(0, 10);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;

  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
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