const express = require("express");
const facilityController = require("../controllers/facilityController");
const facilityDocumentController = require("../controllers/facilityDocumentController");
const facilityNoteController = require("../controllers/facilityNoteController");
const { authenticate } = require("../middleware/authMiddleware");
const { denyRoles } = require("../middleware/roleMiddleware");
const { facilityDocumentUpload, facilityNoteAttachmentUpload } = require("../middleware/uploadMiddleware");

const router = express.Router();

router.use(authenticate);

const employeeWriteGuard = denyRoles("Employee");

router.get("/", facilityController.getAll);
router.get("/search", facilityController.search);
router.post("/resolve", facilityController.resolve);
router.post("/", employeeWriteGuard, facilityController.create);

router.get("/:id/documents", facilityDocumentController.listDocuments);
router.post(
  "/:id/documents",
  employeeWriteGuard,
  facilityDocumentUpload.single("file"),
  facilityDocumentController.uploadDocument
);
router.get(
  "/:id/documents/:documentId/download",
  facilityDocumentController.downloadDocument
);
router.get(
  "/:id/documents/:documentId/preview",
  facilityDocumentController.previewDocument
);
router.delete(
  "/:id/documents/:documentId",
  employeeWriteGuard,
  facilityDocumentController.deleteDocument
);

router.get("/:id/notes", facilityNoteController.listNotes);
router.post(
  "/:id/notes",
  employeeWriteGuard,
  facilityNoteAttachmentUpload.array("attachments", 10),
  facilityNoteController.createNote
);
router.get(
  "/:id/notes/:noteId/attachments/:attachmentId/download",
  facilityNoteController.downloadAttachment
);

router.get("/:id", facilityController.getById);
router.put("/:id", employeeWriteGuard, facilityController.update);
router.delete("/:id", employeeWriteGuard, facilityController.remove);

router.post("/:id/doctors/resolve", facilityController.resolveDoctor);
router.post("/:id/doctors", employeeWriteGuard, facilityController.createDoctors);
router.put(
  "/:id/doctors/:doctorId",
  employeeWriteGuard,
  facilityController.updateDoctor
);
router.patch(
  "/:id/doctors/:doctorId/deactivate",
  employeeWriteGuard,
  facilityController.deactivateDoctor
);
router.patch(
  "/:id/doctors/:doctorId/reactivate",
  employeeWriteGuard,
  facilityController.reactivateDoctor
);
router.patch(
  "/:id/doctors/:doctorId/default",
  employeeWriteGuard,
  facilityController.setDefaultDoctor
);

module.exports = router;
