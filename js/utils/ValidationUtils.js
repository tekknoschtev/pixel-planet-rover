/**
 * ValidationUtils
 *
 * Input validation and constraint checking utilities.
 * Provides consistent validation across all game systems.
 */

class ValidationUtils {
    /**
     * Validate that a value is a number within bounds
     * @param {*} value - Value to validate
     * @param {number} min - Minimum value (inclusive)
     * @param {number} max - Maximum value (inclusive)
     * @param {string} fieldName - Name of field for error messages
     * @returns {object} {valid: boolean, error?: string, value?: number}
     */
    static validateNumber(value, min = -Infinity, max = Infinity, fieldName = 'value') {
        if (value === null || value === undefined) {
            return { valid: false, error: `${fieldName} is required` };
        }

        const num = Number(value);
        if (isNaN(num)) {
            return { valid: false, error: `${fieldName} must be a number` };
        }

        if (num < min || num > max) {
            return {
                valid: false,
                error: `${fieldName} must be between ${min} and ${max}`,
            };
        }

        return { valid: true, value: num };
    }

    /**
     * Validate that a value is an integer
     * @param {*} value
     * @param {number} min
     * @param {number} max
     * @param {string} fieldName
     * @returns {object}
     */
    static validateInteger(value, min = -Infinity, max = Infinity, fieldName = 'value') {
        const numResult = this.validateNumber(value, min, max, fieldName);
        if (!numResult.valid) return numResult;

        if (!Number.isInteger(numResult.value)) {
            return { valid: false, error: `${fieldName} must be an integer` };
        }

        return numResult;
    }

    /**
     * Validate that a value is a string within length bounds
     * @param {*} value
     * @param {number} minLength
     * @param {number} maxLength
     * @param {string} fieldName
     * @returns {object}
     */
    static validateString(value, minLength = 0, maxLength = Infinity, fieldName = 'value') {
        if (value === null || value === undefined) {
            if (minLength > 0) {
                return { valid: false, error: `${fieldName} is required` };
            }
            return { valid: true, value: '' };
        }

        const str = String(value);

        if (str.length < minLength) {
            return {
                valid: false,
                error: `${fieldName} must be at least ${minLength} characters`,
            };
        }

        if (str.length > maxLength) {
            return {
                valid: false,
                error: `${fieldName} must be at most ${maxLength} characters`,
            };
        }

        return { valid: true, value: str };
    }

    /**
     * Validate that a value is one of a set of allowed values
     * @param {*} value
     * @param {array} allowedValues
     * @param {string} fieldName
     * @returns {object}
     */
    static validateEnum(value, allowedValues, fieldName = 'value') {
        if (!Array.isArray(allowedValues) || allowedValues.length === 0) {
            return { valid: false, error: 'No allowed values specified' };
        }

        if (!allowedValues.includes(value)) {
            return {
                valid: false,
                error: `${fieldName} must be one of: ${allowedValues.join(', ')}`,
            };
        }

        return { valid: true, value };
    }

    /**
     * Validate that a value is an array with size constraints
     * @param {*} value
     * @param {number} minLength
     * @param {number} maxLength
     * @param {string} fieldName
     * @returns {object}
     */
    static validateArray(
        value,
        minLength = 0,
        maxLength = Infinity,
        fieldName = 'array'
    ) {
        if (!Array.isArray(value)) {
            return { valid: false, error: `${fieldName} must be an array` };
        }

        if (value.length < minLength) {
            return {
                valid: false,
                error: `${fieldName} must have at least ${minLength} items`,
            };
        }

        if (value.length > maxLength) {
            return {
                valid: false,
                error: `${fieldName} must have at most ${maxLength} items`,
            };
        }

        return { valid: true, value };
    }

    /**
     * Validate that a value is an object with required properties
     * @param {*} value
     * @param {array} requiredProps - Required property names
     * @param {string} fieldName
     * @returns {object}
     */
    static validateObject(value, requiredProps = [], fieldName = 'object') {
        if (typeof value !== 'object' || value === null) {
            return { valid: false, error: `${fieldName} must be an object` };
        }

        for (const prop of requiredProps) {
            if (!(prop in value)) {
                return {
                    valid: false,
                    error: `${fieldName} missing required property: ${prop}`,
                };
            }
        }

        return { valid: true, value };
    }

    /**
     * Validate that a value is a valid color
     * @param {*} value
     * @param {string} fieldName
     * @returns {object}
     */
    static validateColor(value, fieldName = 'color') {
        if (value === null || value === undefined) {
            return { valid: false, error: `${fieldName} is required` };
        }

        try {
            if (typeof ColorUtils !== 'undefined') {
                const color = ColorUtils.parseColor(value);
                return { valid: true, value: color };
            } else {
                // Fallback if ColorUtils not available
                return { valid: true, value };
            }
        } catch (e) {
            return { valid: false, error: `${fieldName} is not a valid color` };
        }
    }

    /**
     * Validate a Three.js Vector3
     * @param {*} value
     * @param {string} fieldName
     * @returns {object}
     */
    static validateVector3(value, fieldName = 'vector') {
        if (!value || typeof value !== 'object') {
            return { valid: false, error: `${fieldName} must be a Vector3` };
        }

        if (!('x' in value) || !('y' in value) || !('z' in value)) {
            return {
                valid: false,
                error: `${fieldName} must have x, y, z components`,
            };
        }

        const x = Number(value.x);
        const y = Number(value.y);
        const z = Number(value.z);

        if (isNaN(x) || isNaN(y) || isNaN(z)) {
            return {
                valid: false,
                error: `${fieldName} components must be numbers`,
            };
        }

        return { valid: true, value };
    }

    /**
     * Validate clamp a number to bounds
     * @param {number} value
     * @param {number} min
     * @param {number} max
     * @returns {number} Clamped value
     */
    static clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    /**
     * Validate and normalize a probability value (0-1)
     * @param {*} value
     * @param {string} fieldName
     * @returns {object}
     */
    static validateProbability(value, fieldName = 'probability') {
        return this.validateNumber(value, 0, 1, fieldName);
    }

    /**
     * Validate a batch of fields using a schema
     * @param {object} data - Data to validate
     * @param {object} schema - {fieldName: {validator, ...params}}
     * @returns {object} {valid: boolean, errors: {}, values: {}}
     */
    static validateSchema(data, schema) {
        const result = {
            valid: true,
            errors: {},
            values: {},
        };

        for (const [fieldName, config] of Object.entries(schema)) {
            const value = data[fieldName];
            const validator = config.validator;

            if (typeof this[validator] !== 'function') {
                result.errors[fieldName] = `Unknown validator: ${validator}`;
                result.valid = false;
                continue;
            }

            const params = config.params || [];
            const validationResult = this[validator](value, ...params, fieldName);

            if (!validationResult.valid) {
                result.errors[fieldName] = validationResult.error;
                result.valid = false;
            } else {
                result.values[fieldName] = validationResult.value;
            }
        }

        return result;
    }

    /**
     * Sanitize a string to prevent injection attacks
     * @param {string} str
     * @returns {string}
     */
    static sanitizeString(str) {
        if (typeof str !== 'string') return '';

        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ValidationUtils;
}
