const express = require("express");
const orderController = require("../controllers/orderController");

const router = express.Router();

router.get("/", orderController.getAll);
router.get("/unprocessed", orderController.getUnprocessed);
router.get("/:id", orderController.getById);
router.post("/", orderController.create);
router.put("/:id", orderController.update);
router.delete("/:id", orderController.remove);

module.exports = router;
