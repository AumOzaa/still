import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { createClient } from "redis";
import logger from "./logger.js";

const redisClient = createClient({ url: 'redis://localhost:6379' });

redisClient.on("error", (err) => {
    console.error("Redis Error:", err);
});

redisClient.on("connect", () => {
    console.log("Redis Connected");
});


try {
    await redisClient.connect();
    logger.info("REDIS CONNECTED");
} catch (error) {
    console.error("Redis Connection Failed:", err);
    logger.error("ERROR CONNECTION TO REDIS");
    process.exit(1);
}


// TODO: For taskCreations stuff use user_id as the key.
export const authLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
        sendCommand: (...args) => redisClient.sendCommand(args),
    }),

    message: {
        message: "Too many attempts made! What are you trying to do :)"
    }
});

export const othLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 90,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
        sendCommand: (...args) => redisClient.sendCommand(args),
    }),

    message: {
        message: "Too many attempts made! What are you trying to do :)"
    }
});
