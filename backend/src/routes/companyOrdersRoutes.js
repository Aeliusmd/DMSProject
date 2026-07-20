const express = require("express");
const { authenticate } = require("../middleware/authMiddleware");
const companyOrdersController = require("../controllers/companyOrdersController");

const router = express.Router();

router.use(authenticate);

router.get("/stats", companyOrdersController.getStats);
router.get("/", companyOrdersController.listOrders);
router.get(
  "/:orderId/new-facility",
  companyOrdersController.getNewFacilityRequest
);
router.post("/:orderId/link-facility", companyOrdersController.linkFacility);
router.post("/:orderId/no-facility", companyOrdersController.markNoFacility);
router.post("/:portalOrderId/sync", companyOrdersController.syncOrder);
router.patch("/:orderId/stage", companyOrdersController.updateStage);
router.post("/:orderId/email-records", companyOrdersController.emailRecords);

module.exports = router;
