import request from "supertest";
import app from "./app.js";
import pool from "./config/db.js";
import { redisClient } from "./config/redis.js";
import logger from "./utils/logger.js";
import { createTask } from "./controllers/task.controller.js";
import { response } from "express";


let authToken = 'bearer ';
let taskId;
beforeAll(async () => {
    await request(app)
        .post("/api/auth/signup")
        .send({
            username: "testUser",
            password: "password123",
        });

    const signinRes = await request(app)
        .post("/api/auth/signin")
        .send({
            username: "testUser",
            password: "password123",
        });

    authToken += signinRes.body.accessToken;
    console.log(authToken);
});

describe("Testing tasks creation", () => {
    test("Task creation", async () => {
        const taskInput = {
            "taskName": "Test task"
        };

        const result = await request(app)
            .post('/api/tasks/createtask')
            .set('Authorization', authToken)
            .send(taskInput);

        expect(result.statusCode).toBe(200);

        taskId = result.body.taskId;
        console.log(taskId);
    });

    test("Get tasks", async () => {
        const result = await request(app)
            .get('/api/tasks/tasks')
            .set('Authorization', authToken)
            .send()

        expect(result.statusCode).toBe(200);
    });

    test("Start a task", async () => {
        const result = await request(app)
            .post(`/api/tasks/task/${taskId}`)
            .set('Authorization', authToken)
            .send()

        expect(result.statusCode).toBe(200);
    });
});

afterAll(async () => {
    await pool.end();
    await redisClient.quit();
});
