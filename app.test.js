import request from "supertest";
import { describe } from "zod";
import app from "./app.js";
import pool from "./config/db.js";
import { redisClient } from "./config/redis.js";

await request(app)
    .post("/api/auth/signup")
    .send({
        username: "testUser",
        password: "password123",
    })
    .expect(200);


test('ends everything :(', async () => {
    await pool.end();
    await redisClient.quit();
});
