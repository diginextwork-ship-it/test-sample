const express = require("express");
const pool = require("../config/db");
const { getGeminiStatus } = require("../resumeparser/resumeparser");

const router = express.Router();

router.get("/health", async (_req, res) => {
  // Always return 200 - don't depend on database for health check
  const health = {
    ok: true,
    server: "running",
    timestamp: new Date().toISOString(),
  };

  // Try database connection but don't fail if it's down
  try {
    await pool.query("SELECT 1");
    health.database = "connected";
  } catch (error) {
    health.database = "disconnected";
    health.databaseError = error.message;
  }

  // Add Gemini status
  try {
    health.gemini = getGeminiStatus();
  } catch (error) {
    health.gemini = "unavailable";
  }

  res.status(200).json(health);
});

module.exports = router;
