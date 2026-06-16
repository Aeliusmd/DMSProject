const express = require("express");
const providerController = require("../controllers/providerController");
const { authenticate } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticate);

router.get("/", providerController.getAll);
router.get("/:id", providerController.getById);

module.exports = router;
