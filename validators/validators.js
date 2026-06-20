import { z } from "zod";

export const userSignup = z.object({
    username: z.string().min(3),
    password: z.string().min(3)
});

export const taskCreation = z.object({
    taskName: z.string().min(2)
})
