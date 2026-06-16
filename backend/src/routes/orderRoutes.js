const express = require("express");
const orderController = require("../controllers/orderController");
const { uploadSinglePdf } = require("../middleware/uploadMiddleware");

const router = express.Router();

router.get("/", orderController.getAll);
router.get("/unprocessed", orderController.getUnprocessed);
router.get("/unprocessed/:extractId", orderController.getUnprocessedById);
router.post(
  "/batch-scan",
  uploadSinglePdf("file"),
  orderController.batchScan
);
router.get("/:id", orderController.getById);
router.post("/", orderController.create);
router.put("/:id", orderController.update);
router.delete("/:id", orderController.remove);

module.exports = router;
