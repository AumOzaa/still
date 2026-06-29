import { Router } from "express";
import { signup, signin } from "../controllers/auth.controllers.js";
import { authLimiter } from "../middleware/rateLimiter.middleware.js";
const router = Router();

router.use(authLimiter);
router.post("/signup", signup);
router.post("/signin", signin);

export default router;
