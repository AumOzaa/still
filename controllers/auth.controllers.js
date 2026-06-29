import { userSignup } from "../validators/validators.js";
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import jwt from "jsonwebtoken";
import pool from "../config/db.js";
import logger from "../utils/logger.js";
import { z } from "zod";

const salt = process.env.SALT_ROUNDS;

export async function signup(req, res, next) {
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
            const passwordHash = await bcrypt.hash(validateData.password, parseInt(salt));
            logger.info("Password hashed");

            validateData.hashedPassword = passwordHash;
            delete validateData.password;
            logger.info("Hashed Password Added to Validation JSON Schema");

            const result = await pool.query(
                ` INSERT INTO users (username, password_hash) VALUES ($1,$2) RETURNING *`,
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
}

export async function signin(req, res) {
    logger.info("POST /api/user/sigin", {
        "username": req.body.username,
    });

    try {
        const validatedData = userSignup.parse(req.body);

        logger.info("Validated User Data", {
            "username": validatedData.username,
            "password": validatedData.password
        });

        // TODO: Check whether user exists

        const response = await pool.query(
            "SELECT * FROM users WHERE username = $1",
            [validatedData.username]
        );

        const user = response.rows[0];

        logger.info("Queried the database");

        if (response) {
            logger.info("Existing user found");
            if (user.username == validatedData.username) {
                // Check password now
                const isPasswordCorrect = await bcrypt.compare(validatedData.password, user.password_hash);

                if (isPasswordCorrect) {

                    const accessToken = jwt.sign({ "userID": user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

                    logger.info("User signed in");
                    res.status(200).json({
                        "username": user.username,
                        "accessToken": accessToken
                    });

                } else {
                    res.status(401).json({
                        "message": "password incorrect"
                    });
                }
            }
        } else {
            logger.info("TEMP : Not the same username");
            return res.json({
                "username": response[0].username
            });
        }

    } catch (error) {
        logger.error(error);

        return res.status(500).json({
            message: error.message
        });
    }
}
