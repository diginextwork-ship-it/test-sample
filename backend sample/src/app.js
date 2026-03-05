const express = require("express");
const cors = require("cors");
const path = require("path");
const healthRoutes = require("./routes/healthRoutes");
const recruiterRoutes = require("./routes/recruiterRoutes");
const jobRoutes = require("./routes/jobRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

app.use(cors());
app.use(express.json({ limit: "25mb" }));

app.use(healthRoutes);
app.use(recruiterRoutes);
app.use(jobRoutes);
app.use(adminRoutes);

const frontendDistPath = path.resolve(__dirname, "../../frontend sample/dist");
app.use(express.static(frontendDistPath));

app.get(/^\/(?!api).*/, (_req, res) => {
  res.sendFile(path.join(frontendDistPath, "index.html"));
});

app.use("/api", (_req, res) => {
  res.status(404).json({ message: "Route not found." });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({
    message: err.message || "Internal server error.",
  });
});

module.exports = app;
