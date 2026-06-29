import { Router } from "express";
import { createTodo, completeTodo, extendTodo, getTodos, deleteTodo } from "../controllers/todo.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";
import { apiLimiter } from "../middleware/rateLimiter.middleware.js";

const router = Router();
router.use(authMiddleware, apiLimiter);
router.post("/todo", createTodo);
router.post("/todo/:id", completeTodo);
router.post("/todo/extend/:id", extendTodo);
router.get("/todo", getTodos);
router.delete("/todo/:id", deleteTodo);

export default router;
