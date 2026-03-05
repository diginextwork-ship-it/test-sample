const dotenv = require("dotenv");

dotenv.config();
const app = require("./src/app");
const pool = require("./src/config/db");

const PORT = process.env.PORT || 8080;

const startServer = async () => {
  try {
    await pool.initDatabase();
    app.listen(PORT, () => {
      console.log(`Backend running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to initialize database schema:", error.message);
    process.exit(1);
  }
};

startServer();
