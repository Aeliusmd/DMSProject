-- activity_logs.module was ENUM without 'Facilities' — facility logs failed silently.
-- Run once: node scripts/migrate-activity-log-module.js

ALTER TABLE activity_logs
  MODIFY COLUMN module VARCHAR(50) NOT NULL;
