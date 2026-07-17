"use client";

import { useState } from "react";
import RecordTypeMultiSelect from "@/components/orders/new-order/RecordTypeMultiSelect";
import CompanyPortalFacilitySearchField from "@/components/company-portal/CompanyPortalFacilitySearchField";
import CompanyPortalAddFacilityModal from "@/components/company-portal/CompanyPortalAddFacilityModal";
import {
  COMPANY_PORTAL_FACILITY_SEARCH_FEE,
  formatFacilityAddressDisplay,
} from "@/lib/company-portal/companyPortalOrderUtils";

function Field({
  label,
  required,
  optional,
  name,
  value,
  onChange,
  error,
  type = "text",
  placeholder,
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-medium text-[#334155]">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
        {optional ? (
          <span className="font-normal text-[#94A3B8]"> (optional)</span>
        ) : null}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(name, event.target.value)}
        className={`h-10 w-full rounded-[8px] border bg-[#F8FAFC] px-3 text-[13px] text-[#0F172A] outline-none transition focus:bg-white focus:ring-2 ${
          error
            ? "border-red-500 focus:ring-red-500/10"
            : "border-[#E2E8F0] focus:border-[#0097B2] focus:ring-[#0097B2]/10"
        }`}
      />
      {error ? <p className="mt-1 text-[12px] text-red-500">{error}</p> : null}
    </div>
  );
}

export default function CompanyOrderVerifyStep({
  form,
  errors,
  onChange,
  onRecordTypesChange,
  onFacilityInputChange,
  onFacilitySelect,
  onAddNewFacility,
  onClearNewFacility,
  onBack,
  onContinue,
  saving,
}) {
  const [showAddFacilityModal, setShowAddFacilityModal] = useState(false);

  const isNewFacilityMode =
    form.requestNewFacilitySearch && form.facilitySelectionMode === "new";
  const isExistingFacilityMode =
    form.facilitySelectionMode === "existing" && form.internalFacilityId;
  const facilitySearchError =
    errors.facilitySelectionMode ||
    errors.internalFacilityId ||
    errors.facilityName ||
    "";

  const handleAddFacility = (values) => {
    onAddNewFacility?.(values);
    setShowAddFacilityModal(false);
  };

  return (
    <div>
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[#ECFDF5] text-[#059669]">
          <AiDocIcon />
        </div>
        <div>
          <h2 className="text-[20px] font-semibold text-[#0F172A]">
            AI Extracted Information
          </h2>
          <p className="mt-1 text-[13px] text-[#64748B]">
            Please verify the extracted details below. Fields marked with * are
            required.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <CompanyPortalFacilitySearchField
          label="Treating Facility"
          value={form.facilityName}
          disabled={isNewFacilityMode}
          onInputChange={onFacilityInputChange}
          onSelect={onFacilitySelect}
          required
          error={facilitySearchError}
        />

        {!isNewFacilityMode ? (
          <button
            type="button"
            onClick={() => setShowAddFacilityModal(true)}
            className="text-[12px] font-medium text-[#0097B2] hover:text-[#0086A0] hover:underline"
          >
            Add your facility name and address
          </button>
        ) : null}

        {isExistingFacilityMode ? (
          <FacilitySummaryCard
            title="Selected facility"
            name={form.facilityName}
            address={formatFacilityAddressDisplay(form)}
            doctor={form.treatingDoctor}
            onClear={onClearNewFacility}
            clearLabel="Change facility"
          />
        ) : null}

        {isNewFacilityMode ? (
          <FacilitySummaryCard
            title="New facility search request"
            badge={`+$${COMPANY_PORTAL_FACILITY_SEARCH_FEE.toFixed(2)} search fee`}
            name={form.facilityName || "Facility name not provided"}
            address={formatFacilityAddressDisplay(form)}
            doctor={form.treatingDoctor}
            onClear={onClearNewFacility}
            clearLabel="Change facility"
          />
        ) : null}

        <RecordTypeMultiSelect
          formData={form}
          onChange={onRecordTypesChange}
          required
          error={errors.type}
        />

        <Field
          label="Treating Doctor"
          optional
          name="treatingDoctor"
          value={form.treatingDoctor}
          onChange={onChange}
          placeholder="Doctor name"
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Applicant Name"
            name="applicantName"
            value={form.applicantName}
            onChange={onChange}
          />
          <Field
            label="Order #"
            required
            name="caseNumber"
            value={form.caseNumber}
            onChange={onChange}
            error={errors.caseNumber}
            placeholder="Enter a unique order number"
          />
          <Field
            label="Case Name"
            name="caseName"
            value={form.caseName}
            onChange={onChange}
          />
          <Field
            label="Rec Number"
            name="recNumber"
            value={form.recNumber}
            onChange={onChange}
          />
          <Field
            label="Date of Birth"
            name="dateOfBirth"
            type="date"
            value={form.dateOfBirth}
            onChange={onChange}
          />
          <Field
            label="Date of Injury"
            name="dateOfInjury"
            type="date"
            value={form.dateOfInjury}
            onChange={onChange}
          />
          <Field
            label="Date Requested"
            name="dateRequested"
            type="date"
            value={form.dateRequested}
            onChange={onChange}
          />
          <Field
            label="Subpoena Date"
            name="subpoenaDate"
            type="date"
            value={form.subpoenaDate}
            onChange={onChange}
          />
          <Field
            label="Requested Record Details"
            name="requestedRecord"
            value={form.requestedRecord}
            onChange={onChange}
            placeholder="Optional notes about records needed"
          />
          <Field
            label="Company Name"
            name="companyName"
            value={form.companyName}
            onChange={onChange}
          />
        </div>

        <Field
          label="Company Street Address"
          name="companyAddress"
          value={form.companyAddress}
          onChange={onChange}
          placeholder="Street address"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field
            label="Company City"
            name="companyCity"
            value={form.companyCity}
            onChange={onChange}
            error={errors.companyCity}
            placeholder="City"
          />
          <Field
            label="Company State"
            name="companyState"
            value={form.companyState}
            onChange={onChange}
            error={errors.companyState}
            placeholder="CA"
          />
          <Field
            label="Company ZIP"
            name="companyZip"
            value={form.companyZip}
            onChange={onChange}
            error={errors.companyZip}
            placeholder="91723"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Contact Email"
            name="contactEmail"
            type="email"
            value={form.contactEmail}
            onChange={onChange}
          />
          <Field
            label="Contact Phone"
            name="contactPhone"
            value={form.contactPhone}
            onChange={onChange}
          />
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] px-5 text-[13px] font-medium text-[#334155] hover:bg-[#F1F5F9]"
        >
          ← Back
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onContinue}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-[8px] bg-[#0097B2] px-5 text-[13px] font-semibold text-white hover:bg-[#0086A0] disabled:cursor-not-allowed disabled:bg-[#0097B2]/45"
        >
          {saving ? "Checking order number..." : "Continue to Payment"} →
        </button>
      </div>

      <CompanyPortalAddFacilityModal
        open={showAddFacilityModal}
        onClose={() => setShowAddFacilityModal(false)}
        onSubmit={handleAddFacility}
        initialValues={{
          facilityName: form.facilityName,
          facilityAddress: form.facilityAddress,
          facilityCity: form.facilityCity,
          facilityState: form.facilityState,
          facilityZip: form.facilityZip,
          treatingDoctor: form.treatingDoctor,
        }}
      />
    </div>
  );
}

function FacilitySummaryCard({
  title,
  badge,
  name,
  address,
  doctor,
  onClear,
  clearLabel = "Change",
}) {
  return (
    <div className="rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[#64748B]">
              {title}
            </p>
            {badge ? (
              <span className="rounded-full bg-[#FFF7ED] px-2 py-0.5 text-[11px] font-medium text-[#EA580C]">
                {badge}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-[14px] font-semibold text-[#0F172A]">{name}</p>
          {address ? (
            <p className="mt-1 text-[12px] text-[#64748B]">{address}</p>
          ) : null}
          {doctor ? (
            <p className="mt-1 text-[12px] text-[#64748B]">Doctor: {doctor}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 text-[12px] font-medium text-[#0097B2] hover:underline"
        >
          {clearLabel}
        </button>
      </div>
    </div>
  );
}

function AiDocIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 4h6l4 4v12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="M14 4v4h4" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="14" r="3" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
