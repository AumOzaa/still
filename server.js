import http from "http";
import app from "./app.js";
import { initSocket } from "./sockets/socket.js";
import logger from "./utils/logger.js";

const server = http.createServer(app);
initSocket(server);

server.listen(3000, "0.0.0.0", () => {
    logger.info("SERVER RUNNING ON http://localhost:3000");
});
