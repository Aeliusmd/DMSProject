-- Employee order milestone rollup (replaces SP — fast reads on large activity_logs).
-- One row per employee + order + metric + day. Updated when order actions occur.

DROP PROCEDURE IF EXISTS sp_employee_order_milestone_stats;

CREATE TABLE IF NOT EXISTS employee_order_milestone_events (
  employee_id   BIGINT UNSIGNED NOT NULL,
  order_id        BIGINT UNSIGNED NOT NULL,
  metric_type     ENUM('created', 'updated', 'completed', 'cancelled', 'deleted') NOT NULL,
  event_date      DATE            NOT NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (employee_id, metric_type, order_id, event_date),
  KEY idx_milestone_events_lookup (employee_id, metric_type, event_date),
  KEY idx_milestone_events_order (order_id),
  CONSTRAINT fk_milestone_events_employee
    FOREIGN KEY (employee_id) REFERENCES matrix_employees (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_milestone_events_order
    FOREIGN KEY (order_id) REFERENCES orders (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
