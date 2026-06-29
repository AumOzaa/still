import jwt from "jsonwebtoken";
import logger from "../utils/logger.js";

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    logger.info("JWT Token parsed");

    // Decoding the payload


    if (!authHeader) {
        return res.status(401).json({
            success: false,
            message: "Access Denied. No token provided"
        });
    }

    try {
        const token = authHeader.split(" ")[1];

        const decoded_payload = jwt.verify(token, process.env.JWT_SECRET);
        logger.info("Payload decoded Successfuly " + JSON.stringify(decoded_payload));
        req.user = decoded_payload;
        next();
    } catch (error) {
        return res.status(403).json({
            success: false,
            message: 'Invalid or expired token.'
        });
    }
}

export default authMiddleware;
