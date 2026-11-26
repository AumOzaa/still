import { Router } from "express";
import { createTodo, completeTodo, extendTodo, getTodos, deleteTodo } from "../controllers/todo.controller.js";
import { requestTodoImageUpload, confirmTodoImage, removeTodoImage } from "../controllers/todo-image.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";
import { apiLimiter } from "../middleware/rateLimiter.middleware.js";

const router = Router();
router.use(authMiddleware, apiLimiter);
router.post("/todo", createTodo);
router.post("/todo/:id", completeTodo);
router.post("/todo/extend/:id", extendTodo);
router.get("/todo", getTodos);
router.delete("/todo/:id", deleteTodo);
router.post("/todo/:id/image/upload-url", requestTodoImageUpload);
router.post("/todo/:id/image", confirmTodoImage);
router.delete("/todo/:id/image", removeTodoImage);

export default router;
