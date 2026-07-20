const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");

const {
    getPasswords,
    addPassword,
    editPassword,
    deletePassword,
    getAnalytics,
    exportVault,
    importVault,
    aiAnalyzeStrength,
    aiDetectPhishing,
    aiRecommendations
} = require("../controllers/passwordController");

// Protect all password vault routes
router.use(authMiddleware);

router.get("/", getPasswords);
router.post("/", addPassword);
router.put("/:id", editPassword);
router.delete("/:id", deletePassword);

router.get("/analytics", getAnalytics);
router.get("/export/:format", exportVault);
router.post("/import", importVault);

router.post("/ai/analyze-strength", aiAnalyzeStrength);
router.post("/ai/detect-phishing", aiDetectPhishing);
router.get("/ai/recommendations", aiRecommendations);

module.exports = router;
