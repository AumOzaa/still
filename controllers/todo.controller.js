import logger from "../utils/logger.js";
import pool from "../config/db.js";
import { getIO } from "../sockets/socket.js";
import { todoCreation } from "../validators/validators.js";

export async function createTodo(req, res) {
    logger.info("POST /api/user/todo");

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
        // Validate the user's todo
        const validateData = todoCreation.parse(req.body);
        const userID = req.user.userID;

        logger.info("USER TODO CREATION DATA VALIDATION SUCCESSFUL", {
            todoName: validateData.todoName,
        });

        const result = await pool.query("INSERT INTO todos (name,user_id) VALUES ($1 , $2) RETURNING *", [validateData.todoName, userID]);
        const io = getIO();

        io.to(userID).emit("todo-created", {
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
}

export async function completeTodo(req, res) {
    logger.info("POST /api/user/todo/:id");

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
        const todoId = req.params.id;
        const result = await pool.query(
            "UPDATE todos SET completed_at = NOW() WHERE id = $1 AND user_id = $2 AND completed_at IS NULL RETURNING *",
            [todoId, userID]
        );

        const io = getIO();
        if (result.rowCount === 0) {
            return res.status(404).json({
                message: "Todo not found",
            });
        }

        io.to(userID).emit("todo-completed", {
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
}

export async function extendTodo(req, res) {
    logger.info("POST /api/user/todo/extend/:id");

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
        const todoId = req.params.id;
        const userID = req.user.userID;
        const result = await pool.query("UPDATE todos SET expires_at = expires_at + INTERVAL '24 hours' , extension_count = extension_count + 1 WHERE id = $1 AND user_id = $2 AND completed_at is NULL AND expired_at is NULL RETURNING *", [todoId, userID]);

        const io = getIO();
        io.to(userID).emit("todo-extended", {
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
}

export async function getTodos(req, res) {
    logger.info("GET /api/user/todo");

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

        const checkExpire = await pool.query("UPDATE todos SET expired_at = NOW() WHERE user_id = $1 AND expired_at IS NULL AND completed_at IS NULL AND expires_at <= NOW() RETURNING *", [userID]);
        const io = getIO();
        if (checkExpire.rowCount > 0) {
            logger.info("Removed the expired todos");

            io.to(userID).emit("todos-expired", {
                todos: checkExpire.rows,
            });
        }

        const result = await pool.query("SELECT id, name, expires_at FROM todos WHERE user_id = $1 AND expired_at IS NULL AND completed_at IS NULL ORDER BY expires_at ASC", [userID]);

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
}

export async function deleteTodo(req, res) {
    logger.info("DEL /api/user/todo/:id ");

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
        const todoId = req.params.id;

        const result = await pool.query("DELETE FROM todos WHERE id = $1 AND user_id = $2 RETURNING *", [todoId, userID]);
        const io = getIO();

        io.to(userID).emit("todo-deleted", {
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
}
