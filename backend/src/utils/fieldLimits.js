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
};

module.exports = {
  TEXT_FIELD_MAX_LENGTH,
  FIELD_LIMITS,
};
