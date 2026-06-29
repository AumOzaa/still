import { createClient } from "redis";
import logger from "../utils/logger.js";

export const redisClient = createClient({
    url: process.env.REDIS_URL,
});

redisClient.on("connect", () => {
    logger.info("REDIS CONNECTED");
});

redisClient.on("error", (err) => {
    logger.error(err);
});

export async function connectRedis() {
    try {
        await redisClient.connect();
    } catch (err) {
        logger.error(err);
        process.exit(1);
    }
}

await redisClient.connect();
logger.info("Redis Connected");
