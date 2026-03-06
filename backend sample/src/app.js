const express = require("express");
const cors = require("cors");
const healthRoutes = require("./routes/healthRoutes");
const recruiterRoutes = require("./routes/recruiterRoutes");
const jobRoutes = require("./routes/jobRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

// CORS Configuration - CRITICAL FOR PRODUCTION
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174", // Vite sometimes uses this
  process.env.FRONTEND_URL, // Single frontend URL
  ...String(process.env.FRONTEND_URLS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean), // Comma-separated URLs for multiple deployments
].filter(Boolean); // Remove undefined values

const allowVercelPreviews =
  String(process.env.ALLOW_VERCEL_PREVIEWS || "false").toLowerCase() === "true";

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) return callback(null, true);

      let isAllowed = allowedOrigins.includes(origin);
      if (!isAllowed && allowVercelPreviews) {
        try {
          const hostname = new URL(origin).hostname.toLowerCase();
          isAllowed = hostname.endsWith(".vercel.app");
        } catch (_error) {
          isAllowed = false;
        }
      }

      if (isAllowed) {
        callback(null, true);
      } else {
        console.warn(`⚠ Blocked CORS request from: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true, // Allow cookies/auth headers
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json({ limit: "25mb" }));

app.get("/", (_req, res) => {
  res.status(200).json({
    ok: true,
    message: "Backend is running.",
    health: "/health",
  });
});

// Routes
app.use(healthRoutes);
app.use(recruiterRoutes);
app.use(jobRoutes);
app.use(adminRoutes);

// 404 handler for API routes
app.use("/api", (_req, res) => {
  res.status(404).json({ message: "Route not found." });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error("Error:", err);

  // Don't expose internal errors in production
  if (process.env.NODE_ENV === "production") {
    res.status(err.status || 500).json({
      message: err.status === 404 ? err.message : "Internal server error.",
    });
  } else {
    res.status(err.status || 500).json({
      message: err.message || "Internal server error.",
      stack: err.stack, // Only in development
    });
  }
});

module.exports = app;
