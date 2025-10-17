/**
 * ErrorHandler
 *
 * Centralized error handling and logging system.
 * Provides consistent error reporting across all game systems.
 */

class ErrorHandler {
    static {
        // Initialize error logging level
        this.logLevel = 'info'; // 'debug', 'info', 'warn', 'error'
        this.errorLog = [];
        this.maxLogEntries = 100;
        this.errorCallbacks = [];
    }

    /**
     * Set the logging level
     * @param {string} level - 'debug', 'info', 'warn', 'error'
     */
    static setLogLevel(level) {
        const validLevels = ['debug', 'info', 'warn', 'error'];
        if (validLevels.includes(level)) {
            this.logLevel = level;
        }
    }

    /**
     * Register a callback to be called when errors occur
     * @param {function} callback - Called with (error, level)
     */
    static onError(callback) {
        if (typeof callback === 'function') {
            this.errorCallbacks.push(callback);
        }
    }

    /**
     * Log a debug message
     * @param {string} context - Where the message originates from (e.g., 'GameEngine')
     * @param {string} message - The message
     * @param {*} data - Optional additional data
     */
    static debug(context, message, data = null) {
        if (this._shouldLog('debug')) {
            console.debug(`[${context}] ${message}`, data);
            this._addToLog('debug', context, message, data);
        }
    }

    /**
     * Log an info message
     * @param {string} context
     * @param {string} message
     * @param {*} data
     */
    static info(context, message, data = null) {
        if (this._shouldLog('info')) {
            console.info(`[${context}] ${message}`, data);
            this._addToLog('info', context, message, data);
        }
    }

    /**
     * Log a warning
     * @param {string} context
     * @param {string} message
     * @param {*} data
     */
    static warn(context, message, data = null) {
        if (this._shouldLog('warn')) {
            console.warn(`[${context}] ${message}`, data);
            this._addToLog('warn', context, message, data);
            this._triggerCallbacks(message, 'warn');
        }
    }

    /**
     * Log an error
     * @param {string} context
     * @param {string|Error} message - Error message or Error object
     * @param {*} data
     * @returns {Error} The error object that was logged
     */
    static error(context, message, data = null) {
        let errorObj = message;

        // Convert string to error if needed
        if (typeof message === 'string') {
            errorObj = new Error(message);
        }

        console.error(`[${context}] ${errorObj.message}`, data, errorObj.stack);
        this._addToLog('error', context, errorObj.message, data);
        this._triggerCallbacks(errorObj, 'error');

        return errorObj;
    }

    /**
     * Wrap async function with error handling
     * @param {function} fn - Async function to wrap
     * @param {string} context - Where the function originates from
     * @returns {function} Wrapped function
     */
    static wrapAsync(fn, context) {
        return async (...args) => {
            try {
                return await fn(...args);
            } catch (error) {
                this.error(context, error);
                throw error;
            }
        };
    }

    /**
     * Wrap sync function with error handling
     * @param {function} fn - Sync function to wrap
     * @param {string} context - Where the function originates from
     * @returns {function} Wrapped function
     */
    static wrapSync(fn, context) {
        return (...args) => {
            try {
                return fn(...args);
            } catch (error) {
                this.error(context, error);
                throw error;
            }
        };
    }

    /**
     * Assert a condition, throw error if false
     * @param {boolean} condition
     * @param {string} message
     * @param {string} context
     * @throws {Error} If condition is false
     */
    static assert(condition, message, context = 'Assert') {
        if (!condition) {
            const error = this.error(context, message);
            throw error;
        }
    }

    /**
     * Catch errors from a promise
     * @param {Promise} promise
     * @param {string} context
     * @returns {Promise}
     */
    static catchPromise(promise, context) {
        return promise.catch((error) => {
            this.error(context, error);
            return null; // Don't rethrow
        });
    }

    /**
     * Get the error log
     * @returns {array}
     */
    static getErrorLog() {
        return [...this.errorLog];
    }

    /**
     * Clear the error log
     */
    static clearErrorLog() {
        this.errorLog = [];
    }

    /**
     * Get error summary
     * @returns {object}
     */
    static getSummary() {
        const summary = {
            total: this.errorLog.length,
            byLevel: {
                debug: 0,
                info: 0,
                warn: 0,
                error: 0,
            },
            contexts: new Set(),
        };

        for (const entry of this.errorLog) {
            summary.byLevel[entry.level] = (summary.byLevel[entry.level] || 0) + 1;
            summary.contexts.add(entry.context);
        }

        summary.contexts = Array.from(summary.contexts);
        return summary;
    }

    // ===== Private methods =====

    /**
     * Check if we should log this level
     * @private
     */
    static _shouldLog(level) {
        const levels = { debug: 0, info: 1, warn: 2, error: 3 };
        return levels[level] >= levels[this.logLevel];
    }

    /**
     * Add entry to error log
     * @private
     */
    static _addToLog(level, context, message, data) {
        this.errorLog.push({
            level,
            context,
            message: typeof message === 'string' ? message : message.toString(),
            data,
            timestamp: new Date().toISOString(),
        });

        // Trim log if it gets too large
        if (this.errorLog.length > this.maxLogEntries) {
            this.errorLog = this.errorLog.slice(-this.maxLogEntries);
        }
    }

    /**
     * Trigger all registered error callbacks
     * @private
     */
    static _triggerCallbacks(error, level) {
        for (const callback of this.errorCallbacks) {
            try {
                callback(error, level);
            } catch (e) {
                console.error('Error in error callback:', e);
            }
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ErrorHandler;
}
