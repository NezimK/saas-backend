/**
 * Logger structuré simple pour le backend
 * Remplace les console.log/error dispersés dans le code
 * Peut être remplacé par winston/pino en production
 */

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL || 'info'];

function formatMessage(level, context, message, data) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}] [${context}]`;
  if (data !== undefined) {
    return `${prefix} ${message} ${typeof data === 'string' ? data : JSON.stringify(data)}`;
  }
  return `${prefix} ${message}`;
}

const logger = {
  debug(context, message, data) {
    if (CURRENT_LEVEL <= LOG_LEVELS.debug) {
      console.log(formatMessage('debug', context, message, data));
    }
  },
  info(context, message, data) {
    if (CURRENT_LEVEL <= LOG_LEVELS.info) {
      console.log(formatMessage('info', context, message, data));
    }
  },
  warn(context, message, data) {
    if (CURRENT_LEVEL <= LOG_LEVELS.warn) {
      console.warn(formatMessage('warn', context, message, data));
    }
  },
  error(context, message, data) {
    if (CURRENT_LEVEL <= LOG_LEVELS.error) {
      console.error(formatMessage('error', context, message, data));
    }
  }
};

module.exports = logger;
