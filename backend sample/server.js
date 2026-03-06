const dotenv = require("dotenv");
dotenv.config();

const app = require("./src/app");
const pool = require("./src/config/db");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // Start server IMMEDIATELY - don't wait for database
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✓ Server running on port ${PORT}`);
    console.log(`✓ Environment: ${process.env.NODE_ENV || "development"}`);
  });

  // Initialize database in background (non-blocking)
  try {
    await pool.initDatabase();
    console.log("✓ Database initialized successfully");
  } catch (error) {
    console.error("⚠ Database initialization failed:", error.message);
    console.error("⚠ Server is running but database may not be ready");
    // Don't exit - let server continue running
  }
};

startServer();
