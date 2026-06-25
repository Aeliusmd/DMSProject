const express = require("express");
const orderController = require("../controllers/orderController");
const { authenticate } = require("../middleware/authMiddleware");
const {
  uploadOrderFiles,
  uploadNoteAttachment,
  uploadSinglePdf,
  uploadMedicalRecordsScan,
} = require("../middleware/uploadMiddleware");

const router = express.Router();

router.use(authenticate);

router.get("/", orderController.getAll);
router.get("/companies", orderController.getFilterCompanies);
router.get("/stats", orderController.getStats);
router.get("/reminders/due-today", orderController.getDueRemindersToday);
router.get("/reminders", orderController.getReminders);
router.get("/doctors/search", orderController.searchDoctors);
router.get("/doctor-addresses/search", orderController.searchDoctorAddresses);
router.get("/unprocessed", orderController.getUnprocessed);
router.get("/unprocessed/:extractId/file", orderController.getUnprocessedFile);
router.get("/unprocessed/:extractId", orderController.getUnprocessedById);
router.post(
  "/subpoena/upload",
  uploadSinglePdf("file"),
  orderController.uploadSubpoena
);
router.post(
  "/batch-scan",
  uploadSinglePdf("file"),
  orderController.batchScan
);
router.get("/:id/subpoena/file", orderController.getSubpoenaFile);
router.get("/:id/medical-records/file", orderController.getMedicalRecordsFile);
router.get("/:id/invoice/print", orderController.getPrintInvoiceFile);
router.get("/:id/invoice/xray/print", orderController.getPrintXrayInvoiceFile);
router.post(
  "/:id/scan-medical-records",
  uploadMedicalRecordsScan,
  orderController.scanMedicalRecords
);
router.delete("/:id/medical-records", orderController.removeMedicalRecords);
router.get("/:id", orderController.getById);
router.post("/", uploadOrderFiles, orderController.create);
router.put("/:id", uploadOrderFiles, orderController.update);
router.delete("/:id", orderController.remove);
router.post("/:id/cancel", orderController.cancel);

router.get("/:id/notes", orderController.getNotes);
router.post("/:id/notes", uploadNoteAttachment, orderController.createNote);
router.put(
  "/:id/notes/:noteId",
  uploadNoteAttachment,
  orderController.updateNote
);

router.get("/:id/activity-logs", orderController.getActivityLogs);

router.get("/:id/workflow-stages", orderController.getWorkflowStages);
router.patch("/:id/workflow-stages", orderController.updateWorkflowStage);
router.post("/:id/mail", orderController.mailCompletedOrder);
router.post("/:id/send-copy-letter", orderController.sendCopyServiceLetter);
router.post("/:id/pickup", orderController.recordPickup);
router.post("/:id/fax", orderController.recordFax);

module.exports = router;
