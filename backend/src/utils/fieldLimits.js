/**
 * Column size limits aligned with dms_full_schema_with_order_records.sql.
 * Use when sanitizing user input before save — GET/read paths are unchanged.
 */

// MySQL TEXT with utf8mb4 (~16k characters; 65,535 bytes max).
const TEXT_FIELD_MAX_LENGTH = 16384;

const FIELD_LIMITS = {
  TEXT: TEXT_FIELD_MAX_LENGTH,
  ORDER_NOTE: 1000,
  FACILITY_NOTE: 500,
  ACTION: 100,
  ACTIVITY_COMPANY_NAME: 200,
  PERFORMER_NAME: 150,
  AUTHOR_NAME: 150,
  VARCHAR_255: 255,
  VARCHAR_200: 200,
  VARCHAR_150: 150,
  VARCHAR_100: 100,
  VARCHAR_50: 50,
  // US ZIP / ZIP+4 from batch-scan extracts (5 or 10 chars) and USPS.
  ZIP_MIN_CHARS: 5,
  ZIP_MAX_CHARS: 10,
  ZIP_MIN_DIGITS: 5,
  ZIP_MAX_DIGITS: 9,
};

// batch_scan_extracts column sizes. XSS-strip extracts, only cap at these.
const EXTRACT_FIELD_LIMITS = {
  applicant_name: 200,
  case_name: 255,
  order_number: 50,
  rec_number: 50,
  ssn: 20,
  customer: 200,
  company_name: 255,
  company_address: 500,
  specific_doctor: 200,
  doctor_address: 500,
  record_type: 100,
  requested_record: TEXT_FIELD_MAX_LENGTH,
  amount: 50,
  cheque_number: 50,
};

module.exports = {
  TEXT_FIELD_MAX_LENGTH,
  FIELD_LIMITS,
  EXTRACT_FIELD_LIMITS,
};
