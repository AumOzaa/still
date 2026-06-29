import { response } from "express";
import request from "supertest";
import { describe } from "zod";
import app from "./app.js";

describe("GET /signup", () => {
    it("Does what?", async () => {
        const res = await request(app)
            .get("/signup")
            .expect("Content-Type", /json/)
            .expect(200);
    })
});
