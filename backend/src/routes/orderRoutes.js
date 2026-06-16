const express = require("express");
const orderController = require("../controllers/orderController");
const { authenticate } = require("../middleware/authMiddleware");
const {
  uploadOrderFiles,
  uploadNoteAttachment,
  uploadSinglePdf,
} = require("../middleware/uploadMiddleware");

const router = express.Router();

router.use(authenticate);

router.get("/", orderController.getAll);
router.get("/unprocessed", orderController.getUnprocessed);
router.get("/unprocessed/:extractId", orderController.getUnprocessedById);
router.post(
  "/batch-scan",
  uploadSinglePdf("file"),
  orderController.batchScan
);
router.get("/:id", orderController.getById);
router.post("/", uploadOrderFiles, orderController.create);
router.put("/:id", uploadOrderFiles, orderController.update);
router.delete("/:id", orderController.remove);

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

module.exports = router;
