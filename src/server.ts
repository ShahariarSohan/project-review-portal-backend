import http, { Server } from "http";
import app from "./app";
import { envVariables } from "./app/config/env";
import { prisma } from "./app/config/prisma";
import seedPlatformAdmin from "./app/utils/seedAdmin";

let server: Server | null = null;

const connectToDB = async () => {
  try {
    await prisma.$connect();
    console.log("PostgreSQL database connected.");
  } catch (err) {
    console.error("Database connection failed:", err);
  }
};

const startServer = async () => {
  try {
    server = http.createServer(app);

    server.listen(envVariables.PORT, () => {
      console.log(`Server is running on port ${envVariables.PORT}`);
    });

    handleProcessEvents();
  } catch (error) {
    console.error("Error during server startup:", error);
    process.exit(1);
  }
};

async function gracefulShutdown(signal: string) {
  console.log(`Received ${signal}, shutting down gracefully...`);

  if (server) {
    server.close(async () => {
      console.log("HTTP server closed.");
      try {
        await prisma.$disconnect();
        console.log("Server shutdown complete.");
      } catch (error) {
        console.error("Error during shutdown:", error);
      }
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

function handleProcessEvents() {
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  process.on("uncaughtException", (error) => {
    console.error("Uncaught exception:", error);
    gracefulShutdown("uncaughtException");
  });
}

(async () => {
  await connectToDB();
  await seedPlatformAdmin();
  await startServer();
})();