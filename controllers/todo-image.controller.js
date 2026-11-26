import logger from "../utils/logger.js";
import pool from "../config/db.js";
import { getIO } from "../sockets/socket.js";
import {
    MAX_IMAGE_BYTES,
    ALLOWED_IMAGE_TYPES,
    buildTodoImageKey,
    todoImagePrefix,
    createImageUploadPost,
    headImage,
    deleteImage,
    createImageReadUrl,
} from "../config/s3.js";
import { todoImageUploadRequest, todoImageConfirm } from "../validators/validators.js";

// Shapes a todo row for the client: the raw key is replaced with a short-lived read URL.
export async function toTodoResponse(row) {
    const { image_key, ...todo } = row;
    return {
        ...todo,
        imageUrl: image_key ? await createImageReadUrl(image_key) : null,
    };
}

async function findActiveOwnedTodo(todoId, userID) {
    const result = await pool.query(
        "SELECT id, image_key FROM todos WHERE id = $1 AND user_id = $2 AND completed_at IS NULL AND expired_at IS NULL",
        [todoId, userID]
    );
    return result.rows[0] || null;
}

function handleError(res, error, label) {
    logger.error(`${label} failed`, {
        message: error.message,
        code: error.code,
        stack: error.stack,
    });
    return res.status(500).json({ message: "Internal server error" });
}

// POST /api/todos/todo/:id/image/upload-url
// Returns a presigned POST policy. The browser uploads straight to S3 with it.
export async function requestTodoImageUpload(req, res) {
    logger.info("POST /api/todos/todo/:id/image/upload-url");

    try {
        const parsed = todoImageUploadRequest.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                message: "Validation error",
                errors: parsed.error.issues,
                allowedTypes: ALLOWED_IMAGE_TYPES,
                maxBytes: MAX_IMAGE_BYTES,
            });
        }

        const userID = req.user.userID;
        const todoId = req.params.id;
        const todo = await findActiveOwnedTodo(todoId, userID);
        if (!todo) {
            return res.status(404).json({ message: "Todo not found" });
        }

        const { contentType } = parsed.data;
        const key = buildTodoImageKey(userID, todoId, contentType);
        const upload = await createImageUploadPost(key, contentType);

        return res.status(200).json({
            url: upload.url,
            fields: upload.fields,
            key,
        });
    } catch (error) {
        return handleError(res, error, "Requesting todo image upload");
    }
}

// POST /api/todos/todo/:id/image
// Called after the browser finished uploading. Verifies the object in S3 before saving it.
export async function confirmTodoImage(req, res) {
    logger.info("POST /api/todos/todo/:id/image");

    try {
        const parsed = todoImageConfirm.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ message: "Validation error", errors: parsed.error.issues });
        }

        const userID = req.user.userID;
        const todoId = req.params.id;
        const { key } = parsed.data;

        // The key must belong to this user's todo. Never trust a client-supplied key blindly.
        if (!key.startsWith(todoImagePrefix(userID, todoId))) {
            return res.status(400).json({ message: "Invalid image key" });
        }

        const todo = await findActiveOwnedTodo(todoId, userID);
        if (!todo) {
            return res.status(404).json({ message: "Todo not found" });
        }

        const object = await headImage(key);
        if (!object) {
            return res.status(400).json({ message: "Image upload not found" });
        }

        const typeOk = ALLOWED_IMAGE_TYPES.includes(object.contentType);
        const sizeOk = object.contentLength > 0 && object.contentLength <= MAX_IMAGE_BYTES;
        if (!typeOk || !sizeOk) {
            await deleteImage(key).catch((err) =>
                logger.error("Failed to remove rejected todo image", { key, message: err.message })
            );
            return res.status(400).json({ message: "Image must be JPEG, PNG or WebP and under 5 MB" });
        }

        const result = await pool.query(
            "UPDATE todos SET image_key = $1 WHERE id = $2 AND user_id = $3 RETURNING id, name, expires_at, image_key",
            [key, todoId, userID]
        );

        // One image per todo: remove the previous object if it was replaced.
        if (todo.image_key && todo.image_key !== key) {
            await deleteImage(todo.image_key).catch((err) =>
                logger.error("Failed to remove replaced todo image", { key: todo.image_key, message: err.message })
            );
        }

        const payload = await toTodoResponse(result.rows[0]);
        getIO().to(userID).emit("todo-updated", { todo: payload });

        return res.status(200).json({ result: payload });
    } catch (error) {
        return handleError(res, error, "Confirming todo image");
    }
}

// DELETE /api/todos/todo/:id/image
export async function removeTodoImage(req, res) {
    logger.info("DELETE /api/todos/todo/:id/image");

    try {
        const userID = req.user.userID;
        const todoId = req.params.id;

        const todo = await findActiveOwnedTodo(todoId, userID);
        if (!todo) {
            return res.status(404).json({ message: "Todo not found" });
        }

        const result = await pool.query(
            "UPDATE todos SET image_key = NULL WHERE id = $1 AND user_id = $2 RETURNING id, name, expires_at, image_key",
            [todoId, userID]
        );

        if (todo.image_key) {
            await deleteImage(todo.image_key).catch((err) =>
                logger.error("Failed to remove todo image", { key: todo.image_key, message: err.message })
            );
        }

        const payload = await toTodoResponse(result.rows[0]);
        getIO().to(userID).emit("todo-updated", { todo: payload });

        return res.status(200).json({ result: payload });
    } catch (error) {
        return handleError(res, error, "Removing todo image");
    }
}
