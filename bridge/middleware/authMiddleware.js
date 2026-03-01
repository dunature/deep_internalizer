export function requireAuth(req, res, next) {
    const apiKey = process.env.BRIDGE_API_KEY;

    // 如果没有配置环境变量，则发出警告但允许通行（开发模式兼容）
    if (!apiKey) {
        console.warn('[Security Warning] BRIDGE_API_KEY is not set. API is unprotected.');
        return next();
    }

    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid token format' });
    }

    const token = authHeader.split(' ')[1];
    if (token !== apiKey) {
        return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
    }

    next();
}
