import { Router } from "express";
import { createTask, deleteTask, getTask, startEndTask, dayAnalytics, timeSinceStart } from "../controllers/task.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";
import app from "../app.js";
import { apiLimiter } from "../middleware/rateLimiter.middleware.js";
const router = Router();

router.use(authMiddleware, apiLimiter);
router.post("/createtask", authMiddleware, createTask);
router.delete("/del/task/:id", authMiddleware, deleteTask);
router.get("/tasks", authMiddleware, getTask);
router.post("/task/:id", authMiddleware, startEndTask);
router.post("/dayAnalytics", authMiddleware, dayAnalytics);
router.post("/timeSinceStart", authMiddleware, timeSinceStart);

export default router;
