import jwt from "jsonwebtoken";

export default function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader) return res.sendStatus(401);

    // Support both "Bearer <token>" and raw token
    const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : authHeader;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('authMiddleware error', err);
    return res.sendStatus(401);
  }
}
