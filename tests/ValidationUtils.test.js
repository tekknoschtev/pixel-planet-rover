import { describe, it, expect } from 'vitest';
import ValidationUtils from '../js/utils/ValidationUtils.js';

describe('ValidationUtils', () => {
    describe('validateNumber', () => {
        it('should validate a valid number', () => {
            const result = ValidationUtils.validateNumber(5, 0, 10, 'test');
            expect(result.valid).toBe(true);
            expect(result.value).toBe(5);
        });

        it('should reject non-numeric strings', () => {
            const result = ValidationUtils.validateNumber('abc', 0, 10, 'test');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('must be a number');
        });

        it('should reject values outside bounds', () => {
            const result = ValidationUtils.validateNumber(15, 0, 10, 'test');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('must be between');
        });

        it('should reject null or undefined', () => {
            const result1 = ValidationUtils.validateNumber(null, 0, 10, 'test');
            const result2 = ValidationUtils.validateNumber(undefined, 0, 10, 'test');
            expect(result1.valid).toBe(false);
            expect(result2.valid).toBe(false);
        });
    });

    describe('validateInteger', () => {
        it('should validate a valid integer', () => {
            const result = ValidationUtils.validateInteger(5, 0, 10, 'test');
            expect(result.valid).toBe(true);
            expect(result.value).toBe(5);
        });

        it('should reject floating point numbers', () => {
            const result = ValidationUtils.validateInteger(5.5, 0, 10, 'test');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('must be an integer');
        });

        it('should reject non-numeric values', () => {
            const result = ValidationUtils.validateInteger('abc', 0, 10, 'test');
            expect(result.valid).toBe(false);
        });
    });

    describe('validateString', () => {
        it('should validate a valid string', () => {
            const result = ValidationUtils.validateString('hello', 1, 100, 'test');
            expect(result.valid).toBe(true);
            expect(result.value).toBe('hello');
        });

        it('should enforce minimum length', () => {
            const result = ValidationUtils.validateString('hi', 5, 100, 'test');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('at least 5 characters');
        });

        it('should enforce maximum length', () => {
            const result = ValidationUtils.validateString('hello world', 0, 5, 'test');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('at most 5 characters');
        });

        it('should allow empty string by default', () => {
            const result = ValidationUtils.validateString('', 0, 100, 'test');
            expect(result.valid).toBe(true);
        });

        it('should require string if minLength > 0', () => {
            const result = ValidationUtils.validateString(null, 1, 100, 'test');
            expect(result.valid).toBe(false);
        });
    });

    describe('validateEnum', () => {
        it('should accept valid enum value', () => {
            const result = ValidationUtils.validateEnum('mars', ['mars', 'moon', 'ice'], 'planet');
            expect(result.valid).toBe(true);
            expect(result.value).toBe('mars');
        });

        it('should reject invalid enum value', () => {
            const result = ValidationUtils.validateEnum('earth', ['mars', 'moon', 'ice'], 'planet');
            expect(result.valid).toBe(false);
        });

        it('should work with numeric enums', () => {
            const result = ValidationUtils.validateEnum(2, [0, 1, 2, 3], 'level');
            expect(result.valid).toBe(true);
        });
    });

    describe('validateArray', () => {
        it('should validate a valid array', () => {
            const result = ValidationUtils.validateArray([1, 2, 3], 0, 10, 'test');
            expect(result.valid).toBe(true);
        });

        it('should enforce minimum length', () => {
            const result = ValidationUtils.validateArray([1, 2], 5, 10, 'test');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('at least 5 items');
        });

        it('should enforce maximum length', () => {
            const result = ValidationUtils.validateArray([1, 2, 3, 4, 5], 0, 3, 'test');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('at most 3 items');
        });

        it('should reject non-array values', () => {
            const result = ValidationUtils.validateArray('not an array', 0, 10, 'test');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('must be an array');
        });
    });

    describe('validateObject', () => {
        it('should validate an object with required properties', () => {
            const result = ValidationUtils.validateObject(
                { x: 1, y: 2, z: 3 },
                ['x', 'y', 'z'],
                'vector'
            );
            expect(result.valid).toBe(true);
        });

        it('should require specified properties', () => {
            const result = ValidationUtils.validateObject(
                { x: 1, y: 2 },
                ['x', 'y', 'z'],
                'vector'
            );
            expect(result.valid).toBe(false);
            expect(result.error).toContain('missing required property: z');
        });

        it('should reject non-objects', () => {
            const result = ValidationUtils.validateObject('not an object', [], 'test');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('must be an object');
        });
    });

    describe('clamp', () => {
        it('should clamp values within bounds', () => {
            expect(ValidationUtils.clamp(5, 0, 10)).toBe(5);
        });

        it('should clamp to minimum', () => {
            expect(ValidationUtils.clamp(-5, 0, 10)).toBe(0);
        });

        it('should clamp to maximum', () => {
            expect(ValidationUtils.clamp(15, 0, 10)).toBe(10);
        });
    });

    describe('validateProbability', () => {
        it('should accept values between 0 and 1', () => {
            expect(ValidationUtils.validateProbability(0.5).valid).toBe(true);
            expect(ValidationUtils.validateProbability(0).valid).toBe(true);
            expect(ValidationUtils.validateProbability(1).valid).toBe(true);
        });

        it('should reject values outside 0-1 range', () => {
            expect(ValidationUtils.validateProbability(-0.1).valid).toBe(false);
            expect(ValidationUtils.validateProbability(1.1).valid).toBe(false);
        });
    });

    describe('validateSchema', () => {
        it('should validate an object against schema', () => {
            const schema = {
                age: { validator: 'validateInteger', params: [0, 120] },
                name: { validator: 'validateString', params: [1, 100] },
            };

            const result = ValidationUtils.validateSchema(
                { age: 25, name: 'John' },
                schema
            );

            expect(result.valid).toBe(true);
        });

        it('should collect validation errors', () => {
            const schema = {
                age: { validator: 'validateInteger', params: [0, 120] },
                name: { validator: 'validateString', params: [1, 100] },
            };

            const result = ValidationUtils.validateSchema(
                { age: 150, name: '' },
                schema
            );

            expect(result.valid).toBe(false);
            expect(Object.keys(result.errors).length).toBe(2);
        });
    });

    describe('sanitizeString', () => {
        it('should sanitize HTML characters', () => {
            const result = ValidationUtils.sanitizeString('<script>alert("xss")</script>');
            expect(result).not.toContain('<');
            expect(result).not.toContain('>');
            expect(result).toContain('&lt;');
            expect(result).toContain('&gt;');
        });

        it('should handle special characters', () => {
            const result = ValidationUtils.sanitizeString('Hello & "World"');
            expect(result).toContain('&amp;');
            expect(result).toContain('&quot;');
        });

        it('should return empty string for non-strings', () => {
            expect(ValidationUtils.sanitizeString(null)).toBe('');
            expect(ValidationUtils.sanitizeString(undefined)).toBe('');
            expect(ValidationUtils.sanitizeString(123)).toBe('');
        });
    });
});
