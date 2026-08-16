const express = require("express");
const staffPersonalOrderController = require("../controllers/staffPersonalOrderController");
const { authenticate } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticate);

router.get("/stats", staffPersonalOrderController.getStats);
router.get(
  "/:orderId/new-facility",
  staffPersonalOrderController.getNewFacilityRequest
);
router.post(
  "/:orderId/link-facility",
  staffPersonalOrderController.linkFacility
);
router.post(
  "/:orderId/no-facility",
  staffPersonalOrderController.markNoFacility
);
router.post(
  "/:orderId/restore-in-process",
  staffPersonalOrderController.restoreInProcess
);

module.exports = router;
