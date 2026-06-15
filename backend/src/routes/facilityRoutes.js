const express = require("express");
const facilityController = require("../controllers/facilityController");
const facilityDocumentController = require("../controllers/facilityDocumentController");
const { authenticate } = require("../middleware/authMiddleware");
const { facilityDocumentUpload } = require("../middleware/uploadMiddleware");

const router = express.Router();

router.use(authenticate);

router.get("/", facilityController.getAll);
router.post("/", facilityController.create);

router.get("/:id/documents", facilityDocumentController.listDocuments);
router.post(
  "/:id/documents",
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
  facilityDocumentController.deleteDocument
);

router.get("/:id", facilityController.getById);
router.put("/:id", facilityController.update);
router.delete("/:id", facilityController.remove);

router.post("/:id/doctors", facilityController.createDoctors);
router.patch("/:id/doctors/:doctorId/deactivate", facilityController.deactivateDoctor);
router.patch("/:id/doctors/:doctorId/reactivate", facilityController.reactivateDoctor);
router.patch("/:id/doctors/:doctorId/default", facilityController.setDefaultDoctor);

module.exports = router;
