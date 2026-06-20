import express from "express";
import logger from "./logger.js";
import { taskCreation, userSignup } from "./validators/validators.js";
import pool from "./neonDemo.js";
import z, { json } from 'zod';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import jwt from "jsonwebtoken"

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

app.post("/api/user/signin", async (req, res) => {
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
            res.json({
                "username": response[0].username
            });
        }

    } catch (error) {
        logger.error(error);

        return res.status(500).json({
            message: error.message
        });
    }
});

app.post("/api/user/createtask", async (req, res) => {
    logger.info("POST /api/user/createtask");

    // ask for jwt token.
    try {
        // taking the JWT
        logger.info("Parsing the token");
        const token = req.headers['authorization'].split(' ')[1];
        logger.info("JWT Token parsed");

        // Decoding the payload
        const decoded_payload = jwt.verify(token, process.env.JWT_SECRET);

        logger.info("Payload decoded Successfuly " + JSON.stringify(decoded_payload));

        // Now creating the task
        const validateData = taskCreation.parse(req.body);
        logger.info("User Data Validated Successfully", {
            "taksName": validateData.taskName
        });

        logger.info("Querying the dataabse for task creation");
        const response = await pool.query("INSERT INTO tasks (user_id,name) VALUES ($1,$2) RETURNING *", [decoded_payload.userID, validateData.taskName]);

        logger.info("Task Created Successfully");

        return res.json({
            "task": validateData.taksName,
            "message": "Task created succesfully"
        });

    } catch (error) {
        logger.error("Something went wrong", {
            "error": error.errors
        });

        res.json({
            "msg": "Something was wrong"
        });
    }
});

app.listen(3000, () => {
    logger.info("SERVER RUNNING ON http://localhost:3000");
});
