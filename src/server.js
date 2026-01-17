require("dotenv").config();

const app = require("./app");
const depositWatcher = require("./jobs/deposit.watcher");

const PORT = process.env.PORT || 3000;

/* ===============================
   SERVER START
=============================== */
const server = app.listen(PORT, () => {
  console.log("================================");
  console.log("🚀 Server started successfully");
  console.log(`🌍 Port: ${PORT}`);
  console.log(`⛓  Network: ${process.env.NETWORK || "BSC"}`);
  console.log("================================");

  try {
    depositWatcher.start();
    console.log("👀 Deposit watcher started");
  } catch (err) {
    console.error("❌ Failed to start deposit watcher:", err.message);
  }
});

/* ===============================
   GRACEFUL SHUTDOWN
=============================== */
const shutdown = (signal) => {
  console.log(`\n🛑 Received ${signal}. Shutting down...`);
  server.close(() => {
    console.log("✅ HTTP server closed");
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
