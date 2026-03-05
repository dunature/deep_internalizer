function isLoopbackAddress(value = '') {
    return (
        value === '127.0.0.1' ||
        value === '::1' ||
        value.startsWith('::ffff:127.0.0.1')
    );
}

function isLocalRequest(req) {
    const remoteIp = req.ip || req.socket?.remoteAddress || '';
    if (isLoopbackAddress(remoteIp)) return true;

    const origin = req.headers.origin || '';
    const referer = req.headers.referer || '';
    const localPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
    if (origin && localPattern.test(origin)) return true;
    if (referer) {
        try {
            const url = new URL(referer);
            if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return true;
        } catch {
            // ignore invalid referer
        }
    }
    return false;
}

export function requireAuth(req, res, next) {
    const apiKey = process.env.BRIDGE_API_KEY;
    const allowLocalNoAuth = process.env.BRIDGE_ALLOW_LOCAL_NO_AUTH !== 'false';

    // 如果没有配置环境变量，则发出警告但允许通行（开发模式兼容）
    if (!apiKey) {
        console.warn('[Security Warning] BRIDGE_API_KEY is not set. API is unprotected.');
        return next();
    }

    const authHeader = req.headers['authorization'];
    if (!authHeader && allowLocalNoAuth && isLocalRequest(req)) {
        return next();
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid token format' });
    }

    const token = authHeader.split(' ')[1];
    if (token !== apiKey) {
        return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
    }

    next();
}
