import express from "express";
import logger from "./logger.js";
import { userSignup } from "./validators/validators.js";
import pool from "./neonDemo.js";
import z, { json } from 'zod';
import bcrypt from 'bcrypt';
import { NeonDbError } from "@neondatabase/serverless";
import dotenv from 'dotenv';
dotenv.config();
const salt = parseInt(process.env.SALT_ROUNDS);

const app = express();
app.use(express.json());


app.post("/api/user/signup", async (req, res) => {
    logger.info("POST /api/user/signup", {
        userName: req.body.username,
        password: req.body.password
    });
    try {

        const validateData = userSignup.parse(req.body);
        logger.info("USER SIGNUP DATA VALIDATION SUCCESSFUL", {
            username: validateData.username,
            password: validateData.password
        });

        const result = await pool.query(
            "SELECT * FROM users WHERE username = $1",
            [validateData.username]
        );

        const user = result.rows[0];

        if (user) {
            logger.info("User already exists");
            return res.status(200).json({
                "msg": "user exists"
            });
        } else {
            logger.info(`Salt added? ${salt}`);
            // creating a new user.
            logger.info("User not found - Creating new user");
            const passwordHash = await bcrypt.hash(validateData.password, salt);
            logger.info("Password hashed");

            validateData.hashedPassword = passwordHash;
            delete validateData.password;
            logger.info("Hashed Password Added to Validation JSON Schema");

            // TODO: Add the user to database
            const result = await pool.query(
                `
INSERT INTO users (
username,
password_hash
) VALUES ($1,$2) RETURNING *
                `,
                [
                    validateData.username,
                    validateData.hashedPassword
                ]
            );

            logger.info("CREATED USER ON THE DATABASE");

            return res.status(200).json({
                "msg": "User Created Successfuly",
                "username": validateData.username
            });
        }

        return res.status(200).json({
            "message": user
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            logger.warn("Signup validation incorrect", {
                errors: error.errors
            });

            return res.status(400).json({
                "message": "Validation error",
                "errors": error.errors
            });
        }

        if (error.code === "23505") {
            logger.warn("Duplicate user signup", {
                message: error.message,
                constraint: error.constraint,
            });

            return res.status(409).json({
                message: "Username or email already exists",
            });
        }
        logger.error("Unknown signup error", {
            name: error.name,
            message: error.message,
            code: error.code,
            detail: error.detail,
            stack: error.stack,
        });

        return res.status(500).json({
            message: "Something went wrong",
        });
    }
});

app.listen(3000, () => {
    logger.info("SERVER RUNNING ON http://localhost:3000");
});
