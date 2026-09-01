-- Batch scan: store user-selected facility and per-subpoena extraction mismatch flags.

ALTER TABLE unprocessed_subpoenas
  ADD COLUMN chosen_facility_id BIGINT UNSIGNED NULL
    COMMENT 'Facility selected on Batch Scan page before upload',
  ADD KEY idx_unprocessed_subpoenas_chosen_facility (chosen_facility_id),
  ADD CONSTRAINT fk_unprocessed_subpoenas_chosen_facility
    FOREIGN KEY (chosen_facility_id) REFERENCES facilities (id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE batch_scan_extracts
  ADD COLUMN extracted_facility_id BIGINT UNSIGNED NULL
    COMMENT 'Facility resolved from subpoena extraction customer field',
  ADD COLUMN facility_mismatch TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 when extracted facility differs from parent chosen_facility_id',
  ADD KEY idx_batch_scan_extracts_extracted_facility (extracted_facility_id),
  ADD KEY idx_batch_scan_extracts_facility_mismatch (facility_mismatch),
  ADD CONSTRAINT fk_batch_scan_extracts_extracted_facility
    FOREIGN KEY (extracted_facility_id) REFERENCES facilities (id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE orders
  ADD COLUMN batch_chosen_facility_id BIGINT UNSIGNED NULL
    COMMENT 'Facility selected at batch scan upload',
  ADD COLUMN extracted_facility_id BIGINT UNSIGNED NULL
    COMMENT 'Facility resolved from subpoena extraction',
  ADD COLUMN facility_mismatch TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 when batch chosen facility differs from extracted facility',
  ADD KEY idx_orders_facility_mismatch (facility_mismatch),
  ADD CONSTRAINT fk_orders_batch_chosen_facility
    FOREIGN KEY (batch_chosen_facility_id) REFERENCES facilities (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT fk_orders_extracted_facility
    FOREIGN KEY (extracted_facility_id) REFERENCES facilities (id)
    ON DELETE RESTRICT ON UPDATE CASCADE;
