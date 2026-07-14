const express = require("express");
const personalPortalController = require("../controllers/personalPortalController");
const {
  authenticatePersonalPortal,
} = require("../middleware/personalPortalAuthMiddleware");
const { uploadPersonalPortalLicense } = require("../middleware/uploadMiddleware");

const router = express.Router();

router.use(authenticatePersonalPortal);

router.get("/dashboard", personalPortalController.getDashboard);
router.get("/requests", personalPortalController.listRequests);
router.post(
  "/requests",
  uploadPersonalPortalLicense,
  personalPortalController.submitAuthenticatedRequest
);

module.exports = router;
