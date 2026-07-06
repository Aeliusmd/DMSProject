-- Employee order milestone stats: index + stored procedure.

-- Created = orders created by employee.

-- Updated / completed / cancelled / deleted = actions performed by employee

-- (activity_logs.performed_by, with orders.created_by / cancelled_by / deleted_by fallback).



CREATE INDEX idx_activity_logs_milestone

  ON activity_logs (performed_by, module, action, log_date);



DROP PROCEDURE IF EXISTS sp_employee_order_milestone_stats;



CREATE PROCEDURE sp_employee_order_milestone_stats(

  IN p_employee_id BIGINT UNSIGNED,

  IN p_from_date DATE,

  IN p_to_date DATE

)

BEGIN

  DECLARE v_created INT DEFAULT 0;

  DECLARE v_updated INT DEFAULT 0;

  DECLARE v_completed INT DEFAULT 0;

  DECLARE v_cancelled INT DEFAULT 0;

  DECLARE v_deleted INT DEFAULT 0;



  SELECT COUNT(DISTINCT order_id)

    INTO v_created

  FROM (

    SELECT CAST(

      NULLIF(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(al.details, 'order_id:', -1), ' |', 1)), '')

      AS UNSIGNED

    ) AS order_id

    FROM activity_logs al

    WHERE al.performed_by = p_employee_id

      AND al.module = 'Orders'

      AND al.action = 'Order Created'

      AND al.details LIKE '%order_id:%'

      AND (p_from_date IS NULL OR al.log_date >= p_from_date)

      AND (p_to_date IS NULL OR al.log_date <= p_to_date)

    UNION

    SELECT o.id AS order_id

    FROM orders o

    WHERE o.created_by = p_employee_id

      AND (p_from_date IS NULL OR DATE(o.created_at) >= p_from_date)

      AND (p_to_date IS NULL OR DATE(o.created_at) <= p_to_date)

  ) created_src

  WHERE order_id IS NOT NULL AND order_id > 0;



  SELECT COUNT(DISTINCT order_id)

    INTO v_updated

  FROM (

    SELECT CAST(

      NULLIF(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(al.details, 'order_id:', -1), ' |', 1)), '')

      AS UNSIGNED

    ) AS order_id

    FROM activity_logs al

    WHERE al.performed_by = p_employee_id

      AND al.module = 'Orders'

      AND al.action = 'Order Updated'

      AND al.details LIKE '%order_id:%'

      AND (p_from_date IS NULL OR al.log_date >= p_from_date)

      AND (p_to_date IS NULL OR al.log_date <= p_to_date)

  ) updated_src

  WHERE order_id IS NOT NULL AND order_id > 0;



  SELECT COUNT(DISTINCT order_id)

    INTO v_completed

  FROM (

    SELECT CAST(

      NULLIF(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(al.details, 'order_id:', -1), ' |', 1)), '')

      AS UNSIGNED

    ) AS order_id

    FROM activity_logs al

    WHERE al.performed_by = p_employee_id

      AND al.module = 'Orders'

      AND al.action IN ('Records Ready Email Sent', 'Order Pickup Recorded')

      AND al.details LIKE '%order_id:%'

      AND (p_from_date IS NULL OR al.log_date >= p_from_date)

      AND (p_to_date IS NULL OR al.log_date <= p_to_date)

    UNION

    SELECT CAST(

      NULLIF(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(al.details, 'order_id:', -1), ' |', 1)), '')

      AS UNSIGNED

    ) AS order_id

    FROM activity_logs al

    WHERE al.performed_by = p_employee_id

      AND al.module = 'Billing'

      AND al.action = 'Invoice Written Off'

      AND al.details LIKE '%Status: Completed%'

      AND al.details LIKE '%order_id:%'

      AND (p_from_date IS NULL OR al.log_date >= p_from_date)

      AND (p_to_date IS NULL OR al.log_date <= p_to_date)

  ) completed_src

  WHERE order_id IS NOT NULL AND order_id > 0;



  SELECT COUNT(DISTINCT order_id)

    INTO v_cancelled

  FROM (

    SELECT CAST(

      NULLIF(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(al.details, 'order_id:', -1), ' |', 1)), '')

      AS UNSIGNED

    ) AS order_id

    FROM activity_logs al

    WHERE al.performed_by = p_employee_id

      AND al.module = 'Orders'

      AND al.action = 'Order Cancelled'

      AND al.details LIKE '%order_id:%'

      AND (p_from_date IS NULL OR al.log_date >= p_from_date)

      AND (p_to_date IS NULL OR al.log_date <= p_to_date)

    UNION

    SELECT o.id AS order_id

    FROM orders o

    WHERE o.cancelled_by = p_employee_id

      AND (p_from_date IS NULL OR DATE(o.cancelled_at) >= p_from_date)

      AND (p_to_date IS NULL OR DATE(o.cancelled_at) <= p_to_date)

  ) cancelled_src

  WHERE order_id IS NOT NULL AND order_id > 0;



  SELECT COUNT(DISTINCT order_id)

    INTO v_deleted

  FROM (

    SELECT CAST(

      NULLIF(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(al.details, 'order_id:', -1), ' |', 1)), '')

      AS UNSIGNED

    ) AS order_id

    FROM activity_logs al

    WHERE al.performed_by = p_employee_id

      AND al.module = 'Orders'

      AND al.action = 'Order Deleted'

      AND al.details LIKE '%order_id:%'

      AND (p_from_date IS NULL OR al.log_date >= p_from_date)

      AND (p_to_date IS NULL OR al.log_date <= p_to_date)

    UNION

    SELECT o.id AS order_id

    FROM orders o

    WHERE o.deleted_by = p_employee_id

      AND (p_from_date IS NULL OR DATE(o.deleted_at) >= p_from_date)

      AND (p_to_date IS NULL OR DATE(o.deleted_at) <= p_to_date)

  ) deleted_src

  WHERE order_id IS NOT NULL AND order_id > 0;



  SELECT

    v_created AS created_orders,

    v_updated AS updated_orders,

    v_completed AS completed_orders,

    v_cancelled AS cancelled_orders,

    v_deleted AS deleted_orders,

    (v_created + v_updated + v_completed + v_cancelled + v_deleted) AS total_orders;

END;

