/**
 * Sentinel Logging Utility
 * Provides structured logging with levels and context
 */

export const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG',
}

const LOG_COLORS = {
  ERROR: '\x1b[31m', // Red
  WARN: '\x1b[33m', // Yellow
  INFO: '\x1b[36m', // Cyan
  DEBUG: '\x1b[90m', // Gray
  RESET: '\x1b[0m',
}

export class Logger {
  constructor(context = 'Sentinel') {
    this.context = context
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString()
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : ''
    return `[${timestamp}] [${level}] [${this.context}] ${message}${metaStr}`
  }

  log(level, message, meta = {}) {
    const color = LOG_COLORS[level] || LOG_COLORS.RESET
    const formatted = this.formatMessage(level, message, meta)
    console.log(`${color}${formatted}${LOG_COLORS.RESET}`)
  }

  error(message, meta = {}) {
    this.log(LOG_LEVELS.ERROR, message, meta)
  }

  warn(message, meta = {}) {
    this.log(LOG_LEVELS.WARN, message, meta)
  }

  info(message, meta = {}) {
    this.log(LOG_LEVELS.INFO, message, meta)
  }

  debug(message, meta = {}) {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
      this.log(LOG_LEVELS.DEBUG, message, meta)
    }
  }
}

// Default logger instance
export const logger = new Logger('Sentinel')

// Factory function
export const createLogger = (context) => new Logger(context)
