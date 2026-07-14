/**
 * Structured logger for USSD service (pino).
 * Shape: timestamp, service, severity, message + context fields.
 */
const pino = require('pino');

const logger = pino({
  name: 'ussd-service',
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});

function child(bindings = {}) {
  return logger.child(bindings);
}

module.exports = {
  logger,
  child,
  debug: (msg, data) => logger.debug(data || {}, msg),
  info: (msg, data) => logger.info(data || {}, msg),
  warn: (msg, data) => logger.warn(data || {}, msg),
  error: (msg, errOrData, data) => {
    if (errOrData instanceof Error) {
      logger.error(
        { err: errOrData, message: errOrData.message, ...(data || {}) },
        msg,
      );
    } else if (errOrData && typeof errOrData === 'object') {
      logger.error(errOrData, msg);
    } else {
      logger.error(data || {}, msg);
    }
  },
};
