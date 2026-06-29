import { taskCreation } from "../validators/validators.js";
import { getIO } from "../sockets/socket.js";
import pool from "../config/db.js";
// import pool from "./neonDemo.js";
// import z from 'zod';
// import { authLimiter, othLimiter } from "../mwares.js";
import logger from "../utils/logger.js";

export async function createTask(req, res) {
    logger.info("POST /api/user/createtask");

    // ask for jwt token.
    try {
        // taking the JWT
        // logger.info("Parsing the token");
        // const token = req.headers['authorization'].split(' ')[1];
        // logger.info("JWT Token parsed");
        //
        // // Decoding the payload
        // const decoded_payload = jwt.verify(token, process.env.JWT_SECRET);
        //
        // logger.info("Payload decoded Successfuly " + JSON.stringify(decoded_payload));
        //
        // Now creating the task
        const validateData = taskCreation.parse(req.body);
        logger.info("User Data Validated Successfully", {
            "taksName": validateData.taskName,
        });

        const userID = req.user.userID;
        logger.info("Querying the dataabse for task creation");
        const response = await pool.query("INSERT INTO tasks (user_id,name) VALUES ($1,$2) RETURNING *", [userID, validateData.taskName]);

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
}

export async function deleteTask(req, res) {
    logger.info("DELETE /api/user/del/task/:id");

    try {
        // logger.info("Parsing the token");
        // const token = req.headers['authorization'].split(' ')[1];
        // logger.info("JWT Token parsed");
        //
        // // Decoding the payload
        // const decoded_payload = jwt.verify(token, process.env.JWT_SECRET);
        //
        // logger.info("Payload decoded Successfuly " + JSON.stringify(decoded_payload));
        //
        // fetching the task
        const delId = req.params.id;
        const userID = req.user.userID;

        logger.info("Task Id to delete " + delId);

        const response = await pool.query("DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING *", [delId, userID]);

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
}

export async function getTask(req, res) {
    logger.info("GET /api/user/tasks");

    try {
        // logger.info("Parsing the token");
        // const token = req.headers['authorization'].split(' ')[1];
        // logger.info("JWT Token parsed");
        //
        // // Decoding the payload
        // const decoded_payload = jwt.verify(token, process.env.JWT_SECRET);
        //
        // logger.info("Payload decoded Successfuly " + JSON.stringify(decoded_payload));
        const userID = req.user.userID;
        const result = await pool.query("SELECT * FROM tasks where user_id = $1", [userID]);

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
}

export async function startEndTask(req, res) {
    logger.info("POST /api/user/task/:id");

    try {
        // logger.info("Parsing the token");
        // const token = req.headers['authorization'].split(' ')[1];
        // logger.info("JWT Token parsed");
        //
        // // Decoding the payload
        // const decoded_payload = jwt.verify(token, process.env.JWT_SECRET);
        //
        // logger.info("Payload decoded Successfuly " + JSON.stringify(decoded_payload));

        const userID = req.user.userID;
        const taskId = req.params.id;
        logger.info("Parsed the taskId " + taskId);

        // ANY OTHER OPERAION FROM HERE

        // TODO: Check whehter task is active or not. If activated then turn it off ang update the current time stamp. If not then just activate the task and start the task
        const isTaskActive = await pool.query("SELECT is_active FROM tasks WHERE id = $1 AND user_id = $2", [taskId, userID]);

        logger.info("Query Made For Task Status " + isTaskActive.rows[0]);

        // res.json({
        //     "taskActiveatedTest": isTaskActive.rows[0]
        // });
        //

        const io = getIO();
        if (isTaskActive.rows[0].is_active == false) {
            logger.info("Task Is Deactivated, initiating new session");

            // Check whether any other active sessions are there.
            const activeSessions = await pool.query("SELECT * FROM task_sessions WHERE user_id = $1 AND end_time IS NULL", [userID]);

            if (activeSessions.rows.length > 0) {
                logger.info("ONE ACTIVE SESSION FOUND!");
                return res.json({
                    "message": "You already have one session running!"
                });
            }

            const updateTask = await pool.query("UPDATE tasks SET is_active = true WHERE id = $1 RETURNING *", [taskId]);
            logger.info("Updated the status to true");
            const result = await pool.query("INSERT INTO task_sessions (user_id,task_id)  VALUES ($1,$2) RETURNING *", [userID, taskId]);
            logger.info("Initialization of Session Done!");

            io.to(userID).emit("task-started", {
                taskId,
                session: result.rows[0]
            });

            return res.json({
                "message": result.rows
            });
        } else {
            logger.info("Task is already Activated, Initiating pause to the session...");

            const updatedTaskSession = await pool.query("UPDATE task_sessions SET end_time = NOW(), sprint_duration = EXTRACT(EPOCH FROM (NOW() - start_time)) WHERE task_id = $1 AND user_id = $2 AND end_time IS NULL RETURNING *", [taskId, userID]);

            await pool.query("UPDATE tasks SET is_active = false WHERE id = $1 RETURNING *", [taskId])

            io.to(userID).emit("task-stopped", {
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
}

export async function dayAnalytics(req, res) {
    logger.info("POST /api/user/dayAnalysis");

    try {
        logger.info("Parsing the token");
        const token = req.headers['authorization'].split(' ')[1];
        logger.info("JWT Token parsed");

        // Decoding the payload
        // const decoded_payload = jwt.verify(token, process.env.JWT_SECRET);
        //
        // logger.info("Payload decoded Successfuly " + JSON.stringify(decoded_payload));
        //
        const userID = req.user.userID;
        const results = await pool.query("SELECT tasks.name , SUM(task_sessions.sprint_duration) FROM tasks JOIN task_sessions on tasks.id = task_sessions.task_id AND DATE(task_sessions.start_time)=CURRENT_DATE AND task_sessions.user_id = $1 GROUP BY tasks.name;", [userID])

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
}

export async function timeSinceStart(req, res) {
    logger.info("GET /api/user/timeSinceStart");

    try {
        // logger.info("Parsing the token");
        // const token = req.headers['authorization'].split(' ')[1];
        // logger.info("JWT Token parsed");
        //
        // // Decoding the payload
        // const decoded_payload = jwt.verify(token, process.env.JWT_SECRET);
        //
        // logger.info("Payload decoded Successfuly " + JSON.stringify(decoded_payload));

        const userID = req.user.userID;

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
            [userID]
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
}
