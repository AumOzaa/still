import { Server } from "socket.io";
import jwt from "jsonwebtoken";

let io;

export function initSocket(server) {
    io = new Server(server, {
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
    return io;
}

export function getIO() {
    if (!io) {
        throw new Error("Socket.io not initialized");
    }

    return io;
}
