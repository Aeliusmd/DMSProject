-- Track when an order's specific doctor was auto-filled from the facility default.
ALTER TABLE orders
  ADD COLUMN specific_doctor_is_default TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 when specific_doctor was set from facility default doctor during auto order creation'
    AFTER specific_doctor;
