const express = require("express");
const invoiceController = require("../controllers/invoiceController");

const router = express.Router();

router.get("/", invoiceController.getAll);
router.get("/company-wise", invoiceController.getCompanyWise);
router.get("/company-wise/:companyId", invoiceController.getByCompany);
router.get("/:id", invoiceController.getById);
router.post("/", invoiceController.create);
router.put("/:id", invoiceController.update);
router.post("/:id/write-off", invoiceController.writeOff);

module.exports = router;
