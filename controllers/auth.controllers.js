import { userSignup } from "../validators/validators.js";
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import jwt, { decode } from "jsonwebtoken";
import pool from "../config/db.js";
import logger from "../utils/logger.js";
import { z } from "zod";
import cookieParser from 'cookie-parser';

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
        logger.info("DB Response", {
            "Response": response.rows
        });
        logger.info("Queried the database");

        if (response.rows && response.rows.length > 0) {
            logger.info("Existing user found");
            if (user.username == validatedData.username) {
                // Check password now
                const isPasswordCorrect = await bcrypt.compare(validatedData.password, user.password_hash);

                if (isPasswordCorrect) {

                    const accessToken = jwt.sign({ "userID": user.id }, process.env.JWT_SECRET, { expiresIn: '15m' });
                    const refreshToken = jwt.sign({ "id": user.id }, process.env.REFRESH_SECRET, { expiresIn: '7d' });

                    const insertRefreshToken = await pool.query("INSERT INTO refresh_tokens (user_id,token_hash,ip_address,expires_at) VALUES ($1,$2,$3,NOW() + INTERVAL '5 minutes')", [user.id, refreshToken, req.ip]);

                    res.cookie('refreshToken', refreshToken, {
                        httpOnly: true,
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: 'strict',
                        maxAge: 7 * 24 * 60 * 60 * 1000
                    });

                    logger.info("User signed in");
                    res.status(200).json({
                        "username": user.username,
                        "accessToken": accessToken,
                        "refreshToken": refreshToken
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
                "username": "How about signing up first?"
            });
        }

    } catch (error) {
        logger.error(error);

        return res.status(500).json({
            message: error.message
        });
    }
}

export default async function refreshToken(req, res) {
    logger.info("POST /api/auth/refresh");
    try {
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) {
            logger.info("No refresh token found");

            return res.status(401).json({
                "message": "Refresh Token Not found!"
            });
        }

        logger.info("Refresh Token found");
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET);
        logger.info("Passed the cryptographic refreshtoken");

        const doesExists = await pool.query("SELECT id from refresh_tokens WHERE token_hash=$2 AND is_revoked is FALSE AND user_id=$1 AND expires_at > NOW()", [decoded.id, refreshToken]);

        logger.info("Request", {
            "refreshTokenId": decoded.id
        });
        if (doesExists.rows.length == 0) return res.status(403).json({ "message": "No token found" });

        logger.info("Created new access token");
        const newAccessToken = jwt.sign(
            { userID: decoded.id },
            process.env.JWT_SECRET,
            { 'expiresIn': '15m' }
        );

        return res.json({
            accessToken: newAccessToken
        });

    } catch (error) {
        logger.error(error);

        return res.status(500).json({
            message: error.message
        });

    }
}
