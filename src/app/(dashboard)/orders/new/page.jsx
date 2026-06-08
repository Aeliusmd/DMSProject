"use client";

import { useMemo, useState } from "react";
import DashboardShell from "@/components/layout/DashboardShell";
import CollapsibleOrderPanel from "@/components/orders/new-order/CollapsibleOrderPanel";
import NewOrderField, {
  CheckboxOption,
  RadioOption,
} from "@/components/orders/new-order/NewOrderField";
import PaymentChargeCard from "@/components/orders/new-order/PaymentChargeCard";
import SubpoenaPreviewContent from "@/components/orders/new-order/SubpoenaPreviewContent";
import CertificateNoRecordsPanel from "@/components/orders/new-order/CertificateNoRecordsPanel";

import {
  formatMoneyInput,
  formatPhone,
  formatSSN,
  immediateRequiredFields,
  moneyFields,
  numericOnlyFields,
  phoneFields,
  validateFile,
  validateNewOrderForm,
} from "@/lib/validations/newOrderValidation";

import {
  OrderIcon,
  PaymentIcon,
  SaveIcon,
  ServeIcon,
  SubpoenaIcon,
} from "@/components/icons/NewOrderIcons";

const initialFormData = {
  customer: "",
  type: "",
  caseNumber: "",
  ssn: "",
  dob: "",

  firstName: "",
  middleName: "",
  lastName: "",
  aka: "",
  defendant: "",
  injuryType: "",

  documentName: "",
  subpoenaFile: null,
  additionalDocumentFile: null,

  orderNumber: "",
  serveCompanyName: "",
  address: "",
  zip: "",
  city: "",
  state: "",
  phone: "",
  fax: "",
  email: "",

  contact1Name: "",
  contact1Title: "",
  contact1Phone: "",
  contact1Fax: "",
  contact1Email: "",

  contact2Name: "",
  contact2Title: "",
  contact2Phone: "",
  contact2Fax: "",
  contact2Email: "",

  dateServed: "",
  depoDueDate: "",
  deliveryDate: "",
  subpoenaDate: "",
  readyDate: "",
  invoiceDate: "",
  xrayInvoiceDate: "",

  medicalRecords: false,
  billingRecords: false,
  employmentRecords: false,
  xrays: false,
  otherRecord: false,

  specificRecord: "",
  specificDoctor: "",
  fullAddress: "",

  certificateNoRecords: false,
  cnrReason: "",
  cnrDelivery: "",
  cnrDateSent: "",
  cnrMemo: false,

  prepaymentCheck: "",
  prepaymentDate: "",
  prepaymentPaid: "",
  prepaymentMemo: "",

  custodianCheck: "",
  custodianDate: "",
  custodianPaid: "",
  custodianMemo: "",

  xrayCheck: "",
  xrayDate: "",
  xrayPaid: "",
  xrayMemo: "",
};

export default function NewOrderPage() {
  const [expandedPanels, setExpandedPanels] = useState({
    subpoena: false,
    order: true,
    serve: true,
    payment: true,
  });

  const [formData, setFormData] = useState(initialFormData);
  const [touched, setTouched] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [fileErrors, setFileErrors] = useState({});

  const errors = useMemo(
    () => validateNewOrderForm(formData, fileErrors),
    [formData, fileErrors]
  );

  const hasImmediateRequiredErrors = immediateRequiredFields.some(
    (field) => errors[field]
  );

  const visiblePanelKeys = formData.subpoenaFile
    ? ["subpoena", "order", "serve", "payment"]
    : ["order", "serve", "payment"];

  const allExpanded = visiblePanelKeys.every((key) => expandedPanels[key]);

  const togglePanel = (panel) => {
    setExpandedPanels((prev) => ({
      ...prev,
      [panel]: !prev[panel],
    }));
  };

  const toggleAllPanels = () => {
    const nextValue = !allExpanded;

    setExpandedPanels((prev) => ({
      ...prev,
      subpoena: formData.subpoenaFile ? nextValue : false,
      order: nextValue,
      serve: nextValue,
      payment: nextValue,
    }));
  };

  const handleBlur = (e) => {
    const { name } = e.target;

    setTouched((prev) => ({
      ...prev,
      [name]: true,
    }));
  };

  const getError = (name) => {
    const shouldShowImmediately = immediateRequiredFields.includes(name);

    if (shouldShowImmediately || touched[name] || submitAttempted) {
      return errors[name] || "";
    }

    return "";
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name === "certificateNoRecords") {
      setFormData((prev) => ({
        ...prev,
        certificateNoRecords: checked,
        cnrReason: checked ? prev.cnrReason : "",
        cnrDelivery: checked ? prev.cnrDelivery : "",
        cnrDateSent: checked ? prev.cnrDateSent : "",
        cnrMemo: checked ? prev.cnrMemo : false,
      }));

      return;
    }

    let nextValue = value;

    if (type === "checkbox") {
      nextValue = checked;
    } else if (phoneFields.includes(name)) {
      nextValue = formatPhone(value);
    } else if (name === "ssn") {
      nextValue = formatSSN(value);
    } else if (name === "zip") {
      nextValue = value.replace(/\D/g, "").slice(0, 5);
    } else if (name === "state") {
      nextValue = value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 2);
    } else if (numericOnlyFields.includes(name)) {
      nextValue = value.replace(/\D/g, "").slice(0, 12);
    } else if (moneyFields.includes(name)) {
      nextValue = formatMoneyInput(value);
    }

    setFormData((prev) => ({
      ...prev,
      [name]: nextValue,
    }));
  };

  const handleFileChange = (e, fieldName) => {
    const file = e.target.files?.[0] || null;
    const error = validateFile(file);

    setFormData((prev) => ({
      ...prev,
      [fieldName]: file,
    }));

    setFileErrors((prev) => ({
      ...prev,
      [fieldName]: error,
    }));

    setTouched((prev) => ({
      ...prev,
      [fieldName]: true,
    }));

    if (fieldName === "subpoenaFile" && file && !error) {
      setExpandedPanels((prev) => ({
        ...prev,
        subpoena: true,
      }));
    }
  };

  const handleSaveOrder = () => {
    setSubmitAttempted(true);

    if (Object.keys(errors).length > 0) {
      console.log("Validation errors:", errors);
      return;
    }

    console.log("New order form data:", formData);
  };

  return (
    <DashboardShell>
      <div className="flex min-h-[calc(100vh-92px)] flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[20px] font-semibold text-[#111827]">
              New Order
            </h1>

            <p className="mt-[4px] text-[13px] text-[#64748B]">
              {formData.subpoenaFile
                ? "Create a new DMS order with attached subpoena"
                : "Create a new DMS order with all required information"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {formData.subpoenaFile && (
              <span className="inline-flex items-center gap-2 rounded-full bg-[#E6F7FA] px-4 py-2 text-[12px] font-semibold text-[#007F96]">
                <SubpoenaIcon />
                Subpoena attached
              </span>
            )}

            <button
              type="button"
              onClick={toggleAllPanels}
              className="w-fit rounded-full bg-[#E6F7FA] px-4 py-2 text-[12px] font-semibold text-[#007F96] hover:bg-[#DDF6FA]"
            >
              {allExpanded ? "↙ Collapse All" : "↗ Expand All"}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 xl:h-[calc(100vh-170px)] xl:flex-row xl:items-stretch">
          {formData.subpoenaFile && (
            <CollapsibleOrderPanel
              title="Subpoena"
              color="subpoena"
              icon={<SubpoenaIcon />}
              expanded={expandedPanels.subpoena}
              onToggle={() => togglePanel("subpoena")}
            >
              <SubpoenaPreviewContent file={formData.subpoenaFile} />
            </CollapsibleOrderPanel>
          )}

          <CollapsibleOrderPanel
            title="Order Details"
            color="order"
            icon={<OrderIcon />}
            expanded={expandedPanels.order}
            onToggle={() => togglePanel("order")}
          >
            <OrderDetailsForm
              formData={formData}
              onChange={handleChange}
              onBlur={handleBlur}
              getError={getError}
              onFileChange={handleFileChange}
              submitAttempted={submitAttempted}
            />
          </CollapsibleOrderPanel>

          <CollapsibleOrderPanel
            title="Serve Info"
            color="serve"
            icon={<ServeIcon />}
            expanded={expandedPanels.serve}
            onToggle={() => togglePanel("serve")}
          >
            <ServeInfoForm
              formData={formData}
              onChange={handleChange}
              onBlur={handleBlur}
              getError={getError}
              onSave={handleSaveOrder}
              disableSave={hasImmediateRequiredErrors}
            />
          </CollapsibleOrderPanel>

          <CollapsibleOrderPanel
            title="Payment"
            color="payment"
            icon={<PaymentIcon />}
            expanded={expandedPanels.payment}
            onToggle={() => togglePanel("payment")}
          >
            <PaymentForm
              formData={formData}
              onChange={handleChange}
              onBlur={handleBlur}
              getError={getError}
            />
          </CollapsibleOrderPanel>
        </div>
      </div>
    </DashboardShell>
  );
}

function OrderDetailsForm({
  formData,
  onChange,
  onBlur,
  getError,
  onFileChange,
  submitAttempted,
}) {
  const hasRequiredErrors =
    getError("customer") ||
    getError("type") ||
    getError("firstName") ||
    getError("lastName");

  return (
    <div className="space-y-5">
      <div className="rounded-[6px] bg-[#F8FAFC] px-3 py-2 text-[11px] font-medium text-[#64748B]">
        <span className="mr-2 text-red-500">*</span>
        <span>* Required field</span>
      </div>

      <div className="space-y-4">
        <NewOrderField
          label="Customer"
          name="customer"
          value={formData.customer}
          onChange={onChange}
          onBlur={onBlur}
          required
          error={getError("customer")}
          options={[
            { label: "By Customer", value: "" },
            { label: "Smith & Associates", value: "smith" },
            { label: "Martinez Legal Group", value: "martinez" },
            { label: "Pacific Law Partners", value: "pacific" },
          ]}
        />

        <NewOrderField
          label="Type"
          name="type"
          value={formData.type}
          onChange={onChange}
          onBlur={onBlur}
          required
          error={getError("type")}
          options={[
            { label: "Select from List", value: "" },
            { label: "Medical Records", value: "medical" },
            { label: "Billing Records", value: "billing" },
            { label: "Employment Records", value: "employment" },
            { label: "X-Rays", value: "xrays" },
          ]}
        />

        <NewOrderField
          label="Case #"
          name="caseNumber"
          value={formData.caseNumber}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="Enter case number"
        />

        <NewOrderField
          label="SSN"
          name="ssn"
          value={formData.ssn}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="XXX-XX-XXXX"
          inputMode="numeric"
          maxLength={11}
          hint="SSN required if you have one"
          error={getError("ssn")}
        />

        <NewOrderField
          label="DOB"
          name="dob"
          value={formData.dob}
          onChange={onChange}
          onBlur={onBlur}
          type="date"
          error={getError("dob")}
        />
      </div>

      <Divider />

      <div>
        <h3 className="text-[13px] font-semibold text-[#111827]">Applicant</h3>
        <p className="mt-[2px] text-[11px] italic text-[#64748B]">
          Completion of this section is required
        </p>

        <div className="mt-4 space-y-4">
          <NewOrderField
            label="First Name"
            name="firstName"
            value={formData.firstName}
            onChange={onChange}
            onBlur={onBlur}
            placeholder="First name"
            required
            error={getError("firstName")}
          />

          <NewOrderField
            label="Middle Name"
            name="middleName"
            value={formData.middleName}
            onChange={onChange}
            onBlur={onBlur}
            placeholder="Middle name"
          />

          <NewOrderField
            label="Last Name"
            name="lastName"
            value={formData.lastName}
            onChange={onChange}
            onBlur={onBlur}
            placeholder="Last name"
            required
            error={getError("lastName")}
          />

          <NewOrderField
            label="AKA"
            name="aka"
            value={formData.aka}
            onChange={onChange}
            onBlur={onBlur}
            placeholder="Also known as"
          />

          <NewOrderField
            label="Defendant"
            name="defendant"
            value={formData.defendant}
            onChange={onChange}
            onBlur={onBlur}
            placeholder="Defendant name"
          />
        </div>
      </div>

      <Divider />

      <div>
        <h3 className="text-[13px] font-semibold text-[#111827]">
          Date Injury
        </h3>

        <p className="mt-[2px] text-[11px] italic text-[#64748B]">
          Complete all relevant information
        </p>

        <div className="mt-3 space-y-2">
          <RadioOption
            label="Specific injury on this date"
            name="injuryType"
            value="specific"
            checked={formData.injuryType === "specific"}
            onChange={onChange}
          />

          <RadioOption
            label="Cumulative injury which began on"
            name="injuryType"
            value="cumulative"
            checked={formData.injuryType === "cumulative"}
            onChange={onChange}
          />
        </div>
      </div>

      <Divider />

      <FileInput
        title="Upload Subpoena"
        onChange={(e) => onFileChange(e, "subpoenaFile")}
        error={getError("subpoenaFile")}
      />

      <div>
        <h3 className="mb-3 text-[13px] font-semibold text-[#111827]">
          Upload Additional Documents
        </h3>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
          <NewOrderField
            name="documentName"
            value={formData.documentName}
            onChange={onChange}
            onBlur={onBlur}
            placeholder="Document Name"
            error={getError("documentName")}
          />

          <FileInput
            compact
            onChange={(e) => onFileChange(e, "additionalDocumentFile")}
            error={getError("additionalDocumentFile")}
          />
        </div>
      </div>

      {(submitAttempted || hasRequiredErrors) && hasRequiredErrors && (
        <div className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-3 text-[12px] font-semibold text-red-600">
          ⓘ Please fill out all required fields
        </div>
      )}

      <Divider />

      <div>
        <h3 className="text-[13px] font-semibold text-[#111827]">Notes</h3>

        <p className="mt-3 text-[12px] font-semibold text-[#64748B]">
          Date By Callback Note
        </p>

        <div className="mt-2 rounded-[8px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-6 text-center text-[12px] text-[#94A3B8]">
          No notes logged yet. Notes will appear here after callbacks are
          recorded.
        </div>
      </div>
    </div>
  );
}

function ServeInfoForm({
  formData,
  onChange,
  onBlur,
  getError,
  onSave,
  disableSave,
}) {
  return (
    <div className="space-y-5">
      <h3 className="text-[14px] font-semibold text-[#111827]">
        Serve Information
      </h3>

      <NewOrderField
        label="Order #"
        name="orderNumber"
        value={formData.orderNumber}
        onChange={onChange}
        onBlur={onBlur}
        placeholder="Order number"
      />

      <Divider />

      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-[#111827]">Company</h3>

        <button
          type="button"
          className="text-[11px] font-semibold text-[#0097B2]"
        >
          clear
        </button>
      </div>

      <NewOrderField
        label="Name"
        name="serveCompanyName"
        value={formData.serveCompanyName}
        onChange={onChange}
        onBlur={onBlur}
        placeholder="company name"
        required
        error={getError("serveCompanyName")}
      />

      <NewOrderField
        label="Address"
        name="address"
        value={formData.address}
        onChange={onChange}
        onBlur={onBlur}
        placeholder="Street address"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <NewOrderField
          label="ZIP"
          name="zip"
          value={formData.zip}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="ZIP"
          inputMode="numeric"
          maxLength={5}
          error={getError("zip")}
        />

        <NewOrderField
          label="City"
          name="city"
          value={formData.city}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="City"
        />

        <NewOrderField
          label="State"
          name="state"
          value={formData.state}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="State"
          maxLength={2}
          error={getError("state")}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NewOrderField
          label="Phone"
          name="phone"
          value={formData.phone}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="(XXX) XXX-XXXX"
          inputMode="numeric"
          maxLength={14}
          error={getError("phone")}
        />

        <NewOrderField
          label="Fax"
          name="fax"
          value={formData.fax}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="(XXX) XXX-XXXX"
          inputMode="numeric"
          maxLength={14}
          error={getError("fax")}
        />
      </div>

      <NewOrderField
        label="Email"
        name="email"
        value={formData.email}
        onChange={onChange}
        onBlur={onBlur}
        placeholder="company@email.com"
        error={getError("email")}
      />

      <Divider />

      <h3 className="text-[13px] font-semibold text-[#111827]">Contact</h3>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ContactCard
          number="1"
          prefix="contact1"
          formData={formData}
          onChange={onChange}
          onBlur={onBlur}
          getError={getError}
        />

        <ContactCard
          number="2"
          prefix="contact2"
          formData={formData}
          onChange={onChange}
          onBlur={onBlur}
          getError={getError}
        />
      </div>

      <Divider />

      <h3 className="text-[13px] font-semibold text-[#111827]">
        Dates and Records
      </h3>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <NewOrderField
            label="Date Served"
            name="dateServed"
            value={formData.dateServed}
            onChange={onChange}
            onBlur={onBlur}
            type="date"
          />

          <NewOrderField
            label="Depo Due Date"
            name="depoDueDate"
            value={formData.depoDueDate}
            onChange={onChange}
            onBlur={onBlur}
            type="date"
          />

          <NewOrderField
            label="Delivery Date"
            name="deliveryDate"
            value={formData.deliveryDate}
            onChange={onChange}
            onBlur={onBlur}
            type="date"
          />

          <NewOrderField
            label="Date of Subpoena"
            name="subpoenaDate"
            value={formData.subpoenaDate}
            onChange={onChange}
            onBlur={onBlur}
            type="date"
          />

          <NewOrderField label="Ready Date" disabled placeholder="-" />
          <NewOrderField label="Invoice Date" disabled placeholder="-" />
          <NewOrderField label="Xray Invoice Date" disabled placeholder="-" />
        </div>

        <div>
          <p className="mb-[6px] text-[11px] font-semibold text-[#475569]">
            Records
          </p>

          <p className="mb-2 text-[10px] italic text-[#94A3B8]">
            Ctrl+Click for multiple selections
          </p>

          <div className="rounded-[8px] border border-[#E2E8F0] bg-white">
            <RecordCheckbox
              label="Medical Records"
              name="medicalRecords"
              checked={formData.medicalRecords}
              onChange={onChange}
            />

            <RecordCheckbox
              label="Billing Records"
              name="billingRecords"
              checked={formData.billingRecords}
              onChange={onChange}
            />

            <RecordCheckbox
              label="Employment Records"
              name="employmentRecords"
              checked={formData.employmentRecords}
              onChange={onChange}
            />

            <RecordCheckbox
              label="X-Rays"
              name="xrays"
              checked={formData.xrays}
              onChange={onChange}
            />

            <div className="px-3 py-2">
              <CheckboxOption
                label="Other"
                name="otherRecord"
                checked={formData.otherRecord}
                onChange={onChange}
              />
            </div>
          </div>
        </div>
      </div>

      <Divider />

      <NewOrderField
        label="Specific Record"
        name="specificRecord"
        value={formData.specificRecord}
        onChange={onChange}
        onBlur={onBlur}
        placeholder="Specific record details"
      />

      <NewOrderField
        label="Specific Doctor"
        name="specificDoctor"
        value={formData.specificDoctor}
        onChange={onChange}
        onBlur={onBlur}
        placeholder="Doctor name"
      />

      <NewOrderField
        label="Full Address"
        name="fullAddress"
        value={formData.fullAddress}
        onChange={onChange}
        onBlur={onBlur}
        textarea
        placeholder="Full address"
      />

      <Divider />

      <CheckboxOption
        label="Certificate of No Records"
        name="certificateNoRecords"
        checked={formData.certificateNoRecords}
        onChange={onChange}
      />

      {formData.certificateNoRecords && (
        <CertificateNoRecordsPanel
          formData={formData}
          onChange={onChange}
          onBlur={onBlur}
          getError={getError}
        />
      )}

      <button
        type="button"
        onClick={onSave}
        disabled={disableSave}
        className={`mt-4 flex h-[42px] w-full items-center justify-center gap-2 rounded-[7px] text-[13px] font-semibold transition ${
          disableSave
            ? "cursor-not-allowed bg-[#E2E8F0] text-[#94A3B8]"
            : "bg-[#0097B2] text-white hover:bg-[#0086A0]"
        }`}
      >
        <SaveIcon />
        Save Order
      </button>
    </div>
  );
}

function PaymentForm({ formData, onChange, onBlur, getError }) {
  return (
    <div className="space-y-5">
      <h3 className="text-[14px] font-semibold text-[#111827]">
        Payment Details
      </h3>

      <PaymentChargeCard
        title="Prepayment Fee"
        amount="$15.00"
        due="$15.00"
        theme="green"
        prefix="prepayment"
        formData={formData}
        onChange={onChange}
        onBlur={onBlur}
        getError={getError}
      />

      <PaymentChargeCard
        title="Custodian Charge"
        amount="$15.00"
        due="$15.00"
        theme="purple"
        prefix="custodian"
        formData={formData}
        onChange={onChange}
        onBlur={onBlur}
        getError={getError}
      />

      <PaymentChargeCard
        title="Xray Charge"
        amount="$0.00"
        due="$-15.00"
        theme="blue"
        prefix="xray"
        formData={formData}
        onChange={onChange}
        onBlur={onBlur}
        getError={getError}
      />
    </div>
  );
}

function ContactCard({ number, prefix, formData, onChange, onBlur, getError }) {
  return (
    <div className="rounded-[8px] bg-[#F8FAFC] p-3">
      <h4 className="mb-3 text-[12px] font-semibold text-[#64748B]">
        Contact {number}
      </h4>

      <div className="space-y-3">
        <NewOrderField
          label="Name"
          name={`${prefix}Name`}
          value={formData[`${prefix}Name`]}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="Contact name"
        />

        <NewOrderField
          label="Title"
          name={`${prefix}Title`}
          value={formData[`${prefix}Title`]}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="Title"
        />

        <NewOrderField
          label="Phone"
          name={`${prefix}Phone`}
          value={formData[`${prefix}Phone`]}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="(XXX) XXX-XXXX"
          inputMode="numeric"
          maxLength={14}
          error={getError(`${prefix}Phone`)}
        />

        <NewOrderField
          label="Fax"
          name={`${prefix}Fax`}
          value={formData[`${prefix}Fax`]}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="(XXX) XXX-XXXX"
          inputMode="numeric"
          maxLength={14}
          error={getError(`${prefix}Fax`)}
        />

        <NewOrderField
          label="Email"
          name={`${prefix}Email`}
          value={formData[`${prefix}Email`]}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="email@example.com"
          error={getError(`${prefix}Email`)}
        />
      </div>
    </div>
  );
}

function FileInput({ title, onChange, error, compact = false }) {
  return (
    <div>
      {title && (
        <h3 className="mb-3 text-[13px] font-semibold text-[#111827]">
          {title}
        </h3>
      )}

      <input
        type="file"
        onChange={onChange}
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        className={`block w-full text-[12px] text-[#64748B] file:mr-3 file:rounded-[6px] file:border file:border-[#E2E8F0] file:bg-white file:px-3 file:py-2 file:text-[12px] file:font-medium file:text-[#334155] ${
          compact ? "max-w-full" : ""
        }`}
      />

      {error && (
        <p className="mt-[5px] text-[11px] font-medium text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}

function RecordCheckbox({ label, name, checked, onChange }) {
  return (
    <div className="border-b border-[#F1F5F9] px-3 py-2 last:border-b-0">
      <CheckboxOption
        label={label}
        name={name}
        checked={checked}
        onChange={onChange}
      />
    </div>
  );
}

function Divider() {
  return <div className="h-px w-full bg-[#E2E8F0]" />;
}