import { z } from "zod";

export const userSignup = z.object({
    username: z.string().min(3),
    password: z.string().min(3)
});

export const taskCreation = z.object({
    taskName: z.string().min(2)
});

export const todoCreation = z.object({
    todoName: z.string().min(2),
});

export const todoImageUploadRequest = z.object({
    contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    size: z.number().int().positive().max(5 * 1024 * 1024),
});

export const todoImageConfirm = z.object({
    key: z.string().min(1).max(1024),
});
