import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import cors from "cors";

dotenv.config();

const start = async () => {
  try {
    await connectDB();
  } catch (e) {
    console.error("⚠️ DB not connected, starting server anyway", e && e.message ? e.message : e);
  }

  const app = express();
  const FRONTEND = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
  app.use(cors({ origin: FRONTEND, credentials: true }));
  app.use(express.json());

  // Health check / root route
  app.get("/", (req, res) => {
    res.json({ status: "Backend is running 🚀" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/user", userRoutes);

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log("=================================");
    console.log("🚀 Backend server is LIVE");
    console.log("📡 Listening on http://localhost:" + PORT);
    console.log("=================================");
  });
};

start();
