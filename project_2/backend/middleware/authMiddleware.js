const jwt = require("jsonwebtoken");
const User = require("../models/user");

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.cookies?.accessToken || 
                      (req.headers.authorization && req.headers.authorization.startsWith("Bearer ") ? req.headers.authorization.split(" ")[1] : null);

        if (!token) {
            return res.status(401).json({ message: "No token provided, authorization denied" });
        }
        
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Check if the user still exists
            const user = await User.findById(decoded.id).select("-password");
            if (!user) {
                return res.status(401).json({ message: "User not found, authorization denied" });
            }

            req.user = user;
            req.sessionId = decoded.sessionId;
            next();
        } catch (err) {
            if (err.name === "TokenExpiredError") {
                return res.status(401).json({ message: "Token expired", code: "TOKEN_EXPIRED" });
            }
            return res.status(401).json({ message: "Token is not valid" });
        }
    } catch (error) {
        console.error("Auth middleware error:", error);
        res.status(500).json({ message: "Server error in authentication middleware" });
    }
};

module.exports = authMiddleware;
