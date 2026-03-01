/**
 * Wrapper for async route handlers to catch exceptions and pass them to Express error handler.
 * Useful for Express < 5 or strict catching of synchronous throw inside async context.
 */
export const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
