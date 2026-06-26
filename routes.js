import express from "express";
import logger from "./logger.js";
import { taskCreation, todoCreation, userSignup } from "./validators/validators.js";
import pool from "./neonDemo.js";
import z, { json } from 'zod';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import jwt from "jsonwebtoken"
import cors from "cors";
import { Server } from "socket.io";
import http from "http";
import { authLimiter, othLimiter } from "./mwares.js";

dotenv.config();
const salt = parseInt(process.env.SALT_ROUNDS);

const app = express();
const server = http.createServer(app);

app.use(cors({
    origin: "*"
}));
app.use(express.json());

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.on("connection", (socket) => {
    logger.info("Connected : ", socket.id);

    socket.on("join-user-room", (token) => {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            socket.join(decoded.userID);

            console.log("Socket joined room:", decoded.userID);
        } catch (error) {
            console.log("Invalid socket token");
            socket.disconnect();
        }
    });
    socket.on("disconnect", () => {
        logger.info("Disconnected ", socket.id);
    });
});

app.post("/api/user/signup", authLimiter, async (req, res) => {
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

app.post("/api/user/signin", authLimiter, async (req, res) => {
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
});

app.post("/api/user/createtask", othLimiter, async (req, res) => {
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
            "taksName": validateData.taskName,
        });

        logger.info("Querying the dataabse for task creation");
        const response = await pool.query("INSERT INTO tasks (user_id,name) VALUES ($1,$2) RETURNING *", [decoded_payload.userID, validateData.taskName]);

        logger.info("Task Created Successfully");

        return res.json({
            "task": validateData.taskName,
            "taskId": response.rows[0].id,
            "message": "Task created succesfully"
        });

    } catch (error) {
        logger.error("Something went wrong", {
            "error": error.errors
        });

        return res.json({
            "msg": "Something was wrong"
        });
    }
});

app.delete("/api/user/del/task/:id", othLimiter, async (req, res) => {
    logger.info("DELETE /api/user/del/task/:id");

    try {
        logger.info("Parsing the token");
        const token = req.headers['authorization'].split(' ')[1];
        logger.info("JWT Token parsed");

        // Decoding the payload
        const decoded_payload = jwt.verify(token, process.env.JWT_SECRET);

        logger.info("Payload decoded Successfuly " + JSON.stringify(decoded_payload));

        // fetching the task
        const delId = req.params.id;

        logger.info("Task Id to delete " + delId);

        const response = await pool.query("DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING *", [delId, decoded_payload.userID]);

        if (response.rows.length === 0) {
            return res.status(404).json({
                message: "Task not found"
            });
        }

        logger.info("TASK DELETED SUCCESFULLY");
        res.status(204).json({
            "tasks": response.rows[0],
            "message": "Task delete successfully"
        });

    } catch (error) {

        if (error instanceof z.ZodError) {
            return res.status(400).json({
                message: "Validation error",
                errors: error.issues
            });
        }

        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                message: "Token expired"
            });
        }

        if (error.name === "JsonWebTokenError") {
            return res.status(401).json({
                message: "Invalid token"
            });
        }

        if (error.name === "NotBeforeError") {
            return res.status(401).json({
                message: "Token not active"
            });
        }

        logger.error("Unknown error", {
            message: error.message,
            code: error.code,
            stack: error.stack
        });

        return res.status(500).json({
            message: "Internal server error"
        });
    }
});

app.get("/api/user/tasks", othLimiter, async (req, res) => {
    logger.info("GET /api/user/tasks");

    try {
        logger.info("Parsing the token");
        const token = req.headers['authorization'].split(' ')[1];
        logger.info("JWT Token parsed");

        // Decoding the payload
        const decoded_payload = jwt.verify(token, process.env.JWT_SECRET);

        logger.info("Payload decoded Successfuly " + JSON.stringify(decoded_payload));

        const result = await pool.query("SELECT * FROM tasks where user_id = $1", [decoded_payload.userID]);

        logger.info("Queried the database");

        res.status(200).json({
            "result": result.rows,
            "message": "Derived Succesfully"
        });
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                message: "Token expired"
            });
        }

        if (error.name === "JsonWebTokenError") {
            return res.status(401).json({
                message: "Invalid token"
            });
        }

        if (error.name === "NotBeforeError") {
            return res.status(401).json({
                message: "Token not active"
            });
        }

        logger.error("Unknown error", {
            message: error.message,
            code: error.code,
            stack: error.stack
        });

        return res.status(500).json({
            message: "Internal server error"
        });
    }
});

// TODO: Start task
app.post("/api/user/task/:id", othLimiter, async (req, res) => {
    logger.info("POST /api/user/task/:id");

    try {
        logger.info("Parsing the token");
        const token = req.headers['authorization'].split(' ')[1];
        logger.info("JWT Token parsed");

        // Decoding the payload
        const decoded_payload = jwt.verify(token, process.env.JWT_SECRET);

        logger.info("Payload decoded Successfuly " + JSON.stringify(decoded_payload));

        const taskId = req.params.id;
        logger.info("Parsed the taskId " + taskId);

        // ANY OTHER OPERAION FROM HERE

        // TODO: Check whehter task is active or not. If activated then turn it off ang update the current time stamp. If not then just activate the task and start the task
        // TODO: An issue exists here, check test this endpoint.
        const isTaskActive = await pool.query("SELECT is_active FROM tasks WHERE id = $1", [taskId]);

        logger.info("Query Made For Task Status " + isTaskActive.rows[0]);

        // res.json({
        //     "taskActiveatedTest": isTaskActive.rows[0]
        // });
        //

        if (isTaskActive.rows[0].is_active == false) {
            logger.info("Task Is Deactivated, initiating new session");

            // Check whether any other active sessions are there.
            const activeSessions = await pool.query("SELECT * FROM task_sessions WHERE user_id = $1 AND end_time IS NULL", [decoded_payload.userID]);

            if (activeSessions.rows.length > 0) {
                logger.info("ONE ACTIVE SESSION FOUND!");
                return res.json({
                    "message": "You already have one session running!"
                });
            }

            const updateTask = await pool.query("UPDATE tasks SET is_active = true WHERE id = $1 RETURNING *", [taskId]);
            logger.info("Updated the status to true");
            const result = await pool.query("INSERT INTO task_sessions (user_id,task_id)  VALUES ($1,$2) RETURNING *", [decoded_payload.userID, taskId]);
            logger.info("Initialization of Session Done!");

            io.to(decoded_payload.userID).emit("task-started", {
                taskId,
                session: result.rows[0]
            });

            return res.json({
                "message": result.rows
            });
        } else {
            logger.info("Task is already Activated, Initiating pause to the session...");

            const updatedTaskSession = await pool.query("UPDATE task_sessions SET end_time = NOW(), sprint_duration = EXTRACT(EPOCH FROM (NOW() - start_time)) WHERE task_id = $1 AND user_id = $2 AND end_time IS NULL RETURNING *", [taskId, decoded_payload.userID]);

            await pool.query("UPDATE tasks SET is_active = false WHERE id = $1 RETURNING *", [taskId])

            io.to(decoded_payload.userID).emit("task-stopped", {
                taskId,
                session: updatedTaskSession.rows[0]
            });
            return res.json({
                "messgae": "Updated Task Settings",
                "isActivated": isTaskActive.rows[0].is_active,
                "newUpdation": updatedTaskSession.rows
            });
        }

    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                message: "Token expired"
            });
        }

        if (error.name === "JsonWebTokenError") {
            return res.status(401).json({
                message: "Invalid token"
            });
        }

        if (error.name === "NotBeforeError") {
            return res.status(401).json({
                message: "Token not active"
            });
        }

        logger.error("Unknown error", {
            message: error.message,
            code: error.code,
            stack: error.stack
        });

        return res.status(500).json({
            message: "Internal server error"
        });
    }
});

app.post("/api/user/dayAnalytics", othLimiter, async (req, res) => {
    logger.info("POST /api/user/dayAnalysis");

    try {
        logger.info("Parsing the token");
        const token = req.headers['authorization'].split(' ')[1];
        logger.info("JWT Token parsed");

        // Decoding the payload
        const decoded_payload = jwt.verify(token, process.env.JWT_SECRET);

        logger.info("Payload decoded Successfuly " + JSON.stringify(decoded_payload));

        const results = await pool.query("SELECT tasks.name , SUM(task_sessions.sprint_duration) FROM tasks JOIN task_sessions on tasks.id = task_sessions.task_id AND DATE(task_sessions.start_time)=CURRENT_DATE AND task_sessions.user_id = $1 GROUP BY tasks.name;", [decoded_payload.userID])

        logger.info("User daily analysis retreived!");

        res.json({
            "result": results.rows
        });
    } catch (error) {

        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                message: "Token expired"
            });
        }

        if (error.name === "JsonWebTokenError") {
            return res.status(401).json({
                message: "Invalid token"
            });
        }

        if (error.name === "NotBeforeError") {
            return res.status(401).json({
                message: "Token not active"
            });
        }

        logger.error("Unknown error", {
            message: error.message,
            code: error.code,
            stack: error.stack
        });

        return res.status(500).json({
            message: "Internal server error"
        });

    }
});

app.get("/api/user/timeSinceStart", othLimiter, async (req, res) => {
    logger.info("GET /api/user/timeSinceStart");

    try {
        logger.info("Parsing the token");
        const token = req.headers['authorization'].split(' ')[1];
        logger.info("JWT Token parsed");

        // Decoding the payload
        const decoded_payload = jwt.verify(token, process.env.JWT_SECRET);

        logger.info("Payload decoded Successfuly " + JSON.stringify(decoded_payload));


        const response = await pool.query(
            `SELECT
                task_sessions.start_time,
                FLOOR(EXTRACT(EPOCH FROM (NOW() - task_sessions.start_time)))::integer AS elapsed_seconds,
                TO_CHAR(
                    NOW() AT TIME ZONE 'UTC',
                    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
                ) AS server_time_utc
            FROM task_sessions
            JOIN tasks ON task_sessions.task_id = tasks.id
            WHERE task_sessions.end_time IS NULL
                AND task_sessions.user_id = $1
                AND tasks.user_id = $1
            ORDER BY task_sessions.start_time DESC
            LIMIT 1`,
            [decoded_payload.userID]
        );

        logger.info("Got the start time of the tasks if any");

        res.status(200).json({
            "toStartTime": response.rows[0] || null
        });
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                message: "Token expired"
            });
        }

        if (error.name === "JsonWebTokenError") {
            return res.status(401).json({
                message: "Invalid token"
            });
        }

        if (error.name === "NotBeforeError") {
            return res.status(401).json({
                message: "Token not active"
            });
        }

        logger.error("Unknown error", {
            message: error.message,
            code: error.code,
            stack: error.stack
        });

        return res.status(500).json({
            message: "Internal server error"
        });
    }
});

app.post("/api/user/todo", othLimiter, async (req, res) => {
    logger.info("POST /api/user/todo");

    try {
        logger.info("Parsing the token");
        const token = req.headers['authorization'].split(' ')[1];
        logger.info("JWT Token parsed");

        // Decoding the payload
        const decoded_payload = jwt.verify(token, process.env.JWT_SECRET);

        logger.info("Payload decoded Successfuly " + JSON.stringify(decoded_payload));

        // Validate the user's todo
        const validateData = todoCreation.parse(req.body);

        logger.info("USER TODO CREATION DATA VALIDATION SUCCESSFUL", {
            todoName: validateData.todoName,
        });

        // TODO: create a todo.

        const result = await pool.query("INSERT INTO todos (name,user_id) VALUES ($1 , $2) RETURNING *", [validateData.todoName, decoded_payload.userID]);

        io.to(decoded_payload.userID).emit("todo-created", {
            todo: result.rows[0]
        });

        res.status(200).json({
            "result": result.rows[0] || null
        });

    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                message: "Token expired"
            });
        }

        if (error.name === "JsonWebTokenError") {
            return res.status(401).json({
                message: "Invalid token"
            });
        }

        if (error.name === "NotBeforeError") {
            return res.status(401).json({
                message: "Token not active"
            });
        }

        logger.error("Unknown error", {
            message: error.message,
            code: error.code,
            stack: error.stack
        });

        return res.status(500).json({
            message: "Internal server error"
        });
    }

});

app.post("/api/user/todo/:id", othLimiter, async (req, res) => {
    logger.info("POST /api/user/todo/:id");

    try {
        logger.info("Parsing the token");
        const token = req.headers['authorization'].split(' ')[1];
        logger.info("JWT Token parsed");

        // Decoding the payload
        const decoded_payload = jwt.verify(token, process.env.JWT_SECRET);

        logger.info("Payload decoded Successfuly " + JSON.stringify(decoded_payload));
        // TODO: create a todo.

        const todoId = req.params.id;
        const result = await pool.query(
            "UPDATE todos SET completed_at = NOW() WHERE id = $1 AND user_id = $2 AND completed_at IS NULL RETURNING *",
            [todoId, decoded_payload.userID]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                message: "Todo not found",
            });
        }

        io.to(decoded_payload.userID).emit("todo-completed", {
            todo: result.rows[0]
        });

        res.status(200).json({
            "result": result.rows[0] || null
        });

    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                message: "Token expired"
            });
        }

        if (error.name === "JsonWebTokenError") {
            return res.status(401).json({
                message: "Invalid token"
            });
        }

        if (error.name === "NotBeforeError") {
            return res.status(401).json({
                message: "Token not active"
            });
        }

        logger.error("Unknown error", {
            message: error.message,
            code: error.code,
            stack: error.stack
        });

        return res.status(500).json({
            message: "Internal server error"
        });
    }

});

app.post("/api/user/todo/extend/:id", othLimiter, async (req, res) => {
    logger.info("POST /api/user/todo/extend/:id");

    try {
        logger.info("Parsing the token");
        const token = req.headers['authorization'].split(' ')[1];
        logger.info("JWT Token parsed");

        // Decoding the payload
        const decoded_payload = jwt.verify(token, process.env.JWT_SECRET);

        logger.info("Payload decoded Successfuly " + JSON.stringify(decoded_payload));
        // TODO: create a todo.

        const todoId = req.params.id;

        // TODO: Need to check whether the user is deleting it's own task
        const result = await pool.query("UPDATE todos SET expires_at = expires_at + INTERVAL '24 hours' , extension_count = extension_count + 1 WHERE id = $1 AND user_id = $2 AND completed_at is NULL AND expired_at is NULL RETURNING *", [todoId, decoded_payload.userID]);

        io.to(decoded_payload.userID).emit("todo-extended", {
            todo: result.rows[0]
        })
        logger.info("User task postponed for 24 hours");

        res.status(200).json({
            "result": result.rows[0] || null
        });

    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                message: "Token expired"
            });
        }

        if (error.name === "JsonWebTokenError") {
            return res.status(401).json({
                message: "Invalid token"
            });
        }

        if (error.name === "NotBeforeError") {
            return res.status(401).json({
                message: "Token not active"
            });
        }

        logger.error("Unknown error", {
            message: error.message,
            code: error.code,
            stack: error.stack
        });

        return res.status(500).json({
            message: "Internal server error"
        });
    }

});

app.get("/api/user/todo", othLimiter, async (req, res) => {
    logger.info("GET /api/user/todo");

    try {
        logger.info("Parsing the token");
        const token = req.headers['authorization'].split(' ')[1];
        logger.info("JWT Token parsed");

        // Decoding the payload
        const decoded_payload = jwt.verify(token, process.env.JWT_SECRET);

        logger.info("Payload decoded Successfuly " + JSON.stringify(decoded_payload));

        // TODO: Expire the tasks which have passed the expires_on date.

        const checkExpire = await pool.query("UPDATE todos SET expired_at = NOW() WHERE user_id = $1 AND expired_at IS NULL AND completed_at IS NULL AND expires_at <= NOW() RETURNING *", [decoded_payload.userID]);

        if (checkExpire.rowCount > 0) {
            logger.info("Removed the expired todos");

            io.to(decoded_payload.userID).emit("todos-expired", {
                todos: checkExpire.rows,
            });
        }

        // TODO: Need to check whether the user is deleting it's own task
        const result = await pool.query("SELECT id, name, expires_at FROM todos WHERE user_id = $1 AND expired_at IS NULL AND completed_at IS NULL ORDER BY expires_at ASC", [decoded_payload.userID]);

        logger.info("Fetched the existing todos");

        res.status(200).json({
            "result": result.rows || null
        });

    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                message: "Token expired"
            });
        }

        if (error.name === "JsonWebTokenError") {
            return res.status(401).json({
                message: "Invalid token"
            });
        }

        if (error.name === "NotBeforeError") {
            return res.status(401).json({
                message: "Token not active"
            });
        }

        logger.error("Unknown error", {
            message: error.message,
            code: error.code,
            stack: error.stack
        });

        return res.status(500).json({
            message: "Internal server error"
        });
    }

});

app.delete("/api/user/todo/:id", othLimiter, async (req, res) => {
    logger.info("DEL /api/user/todo/:id ");

    try {
        logger.info("Parsing the token");
        const token = req.headers['authorization'].split(' ')[1];
        logger.info("JWT Token parsed");

        // Decoding the payload
        const decoded_payload = jwt.verify(token, process.env.JWT_SECRET);

        logger.info("Payload decoded Successfuly " + JSON.stringify(decoded_payload));

        const todoId = req.params.id;

        // TODO: Need to check whether the user is deleting it's own task
        const result = await pool.query("DELETE FROM todos WHERE id = $1 AND user_id = $2 RETURNING *", [todoId, decoded_payload.userID
        ]);

        io.to(decoded_payload.userID).emit("todo-deleted", {
            todoId
        })

        if (result.rowCount === 0) {
            return res.status(404).json({
                message: "Todo not found",
            });
        }

        return res.json({
            message: "Todo deleted",
            todo: result.rows[0],
        });

    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                message: "Token expired"
            });
        }

        if (error.name === "JsonWebTokenError") {
            return res.status(401).json({
                message: "Invalid token"
            });
        }

        if (error.name === "NotBeforeError") {
            return res.status(401).json({
                message: "Token not active"
            });
        }

        logger.error("Unknown error", {
            message: error.message,
            code: error.code,
            stack: error.stack
        });

        return res.status(500).json({
            message: "Internal server error"
        });
    }


});

server.listen(3000, () => {
    logger.info("SERVER RUNNING ON http://localhost:3000");
});

// app.listen(3000, "0.0.0.0", () => {
//     logger.info("SERVER RUNNING ON http://localhost:3000");
// });
