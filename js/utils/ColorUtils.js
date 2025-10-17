/**
 * ColorUtils
 *
 * Shared color manipulation and conversion utilities.
 * Consolidates color handling that was scattered across planetTypes.js, planetGenerator.js, and planetObjects.js.
 * Provides consistent color representation using THREE.Color internally.
 */

class ColorUtils {
    /**
     * Parse a color from various formats to THREE.Color
     * Supports: hex string (0xRRGGBB or #RRGGBB), hex number, THREE.Color, array [r,g,b], object {r,g,b}
     * @param {*} color - Color in any supported format
     * @returns {THREE.Color} Standardized THREE.Color object
     */
    static parseColor(color) {
        if (!color) {
            return new THREE.Color(0xffffff); // Default to white
        }

        // Already a THREE.Color
        if (color instanceof THREE.Color) {
            return color;
        }

        // Hex string format: "0xRRGGBB" or "#RRGGBB"
        if (typeof color === 'string') {
            const hexString = color.replace(/^0x/, '#');
            return new THREE.Color(hexString);
        }

        // Hex number format
        if (typeof color === 'number') {
            return new THREE.Color(color);
        }

        // Array format: [r, g, b] where values are 0-1
        if (Array.isArray(color)) {
            return new THREE.Color(color[0], color[1], color[2]);
        }

        // Object format: {r, g, b} where values are 0-1
        if (typeof color === 'object' && ('r' in color || 'g' in color || 'b' in color)) {
            return new THREE.Color(color.r || 0, color.g || 0, color.b || 0);
        }

        console.warn('Unknown color format:', color, 'defaulting to white');
        return new THREE.Color(0xffffff);
    }

    /**
     * Convert THREE.Color to hex number
     * @param {THREE.Color|*} color
     * @returns {number} Hex color as number (0xRRGGBB)
     */
    static toHexNumber(color) {
        const threeColor = this.parseColor(color);
        return threeColor.getHex();
    }

    /**
     * Convert THREE.Color to hex string
     * @param {THREE.Color|*} color
     * @returns {string} Hex color string (0xRRGGBB)
     */
    static toHexString(color) {
        const hex = this.toHexNumber(color);
        return '0x' + hex.toString(16).padStart(6, '0');
    }

    /**
     * Extract RGB components from a color as 0-255 values
     * @param {THREE.Color|*} color
     * @returns {object} {r, g, b} with values 0-255
     */
    static toRGB255(color) {
        const threeColor = this.parseColor(color);
        return {
            r: Math.round(threeColor.r * 255),
            g: Math.round(threeColor.g * 255),
            b: Math.round(threeColor.b * 255),
        };
    }

    /**
     * Extract RGB components from a color as 0-1 values
     * @param {THREE.Color|*} color
     * @returns {object} {r, g, b} with values 0-1
     */
    static toRGB(color) {
        const threeColor = this.parseColor(color);
        return {
            r: threeColor.r,
            g: threeColor.g,
            b: threeColor.b,
        };
    }

    /**
     * Lighten a color by reducing RGB values (as used in planetObjects.js for object colors)
     * @param {THREE.Color|*} color
     * @param {number} amount - Amount to reduce (0-255 scale)
     * @returns {THREE.Color}
     */
    static darken(color, amount) {
        const rgb255 = this.toRGB255(color);
        return new THREE.Color(
            Math.max(0, rgb255.r - amount) / 255,
            Math.max(0, rgb255.g - amount) / 255,
            Math.max(0, rgb255.b - amount) / 255
        );
    }

    /**
     * Brighten a color
     * @param {THREE.Color|*} color
     * @param {number} amount - Amount to increase (0-255 scale)
     * @returns {THREE.Color}
     */
    static brighten(color, amount) {
        const rgb255 = this.toRGB255(color);
        return new THREE.Color(
            Math.min(255, rgb255.r + amount) / 255,
            Math.min(255, rgb255.g + amount) / 255,
            Math.min(255, rgb255.b + amount) / 255
        );
    }

    /**
     * Lerp (linearly interpolate) between two colors
     * @param {THREE.Color|*} colorA
     * @param {THREE.Color|*} colorB
     * @param {number} t - Interpolation factor (0-1)
     * @returns {THREE.Color}
     */
    static lerp(colorA, colorB, t) {
        const a = this.parseColor(colorA);
        const b = this.parseColor(colorB);

        const result = new THREE.Color();
        result.r = a.r + (b.r - a.r) * t;
        result.g = a.g + (b.g - a.g) * t;
        result.b = a.b + (b.b - a.b) * t;

        return result;
    }

    /**
     * Mix multiple colors with specified weights
     * @param {array} colors - Array of colors
     * @param {array} weights - Array of weights (should sum to 1)
     * @returns {THREE.Color}
     */
    static mix(colors, weights) {
        if (colors.length !== weights.length) {
            throw new Error('Colors and weights arrays must have same length');
        }

        const result = new THREE.Color(0, 0, 0);
        let totalWeight = 0;

        for (let i = 0; i < colors.length; i++) {
            const color = this.parseColor(colors[i]);
            const weight = weights[i];

            result.r += color.r * weight;
            result.g += color.g * weight;
            result.b += color.b * weight;
            totalWeight += weight;
        }

        // Normalize if weights don't sum to 1
        if (totalWeight > 0 && Math.abs(totalWeight - 1.0) > 0.001) {
            result.r /= totalWeight;
            result.g /= totalWeight;
            result.b /= totalWeight;
        }

        return result;
    }

    /**
     * Get complementary (opposite) color
     * @param {THREE.Color|*} color
     * @returns {THREE.Color}
     */
    static complement(color) {
        const threeColor = this.parseColor(color);
        return new THREE.Color(1 - threeColor.r, 1 - threeColor.g, 1 - threeColor.b);
    }

    /**
     * Calculate perceived brightness (luminance) of a color
     * Uses relative luminance formula
     * @param {THREE.Color|*} color
     * @returns {number} Brightness 0-1
     */
    static getBrightness(color) {
        const threeColor = this.parseColor(color);
        // Relative luminance formula
        return (0.299 * threeColor.r + 0.587 * threeColor.g + 0.114 * threeColor.b);
    }

    /**
     * Validate if a color is valid
     * @param {*} color
     * @returns {boolean}
     */
    static isValidColor(color) {
        try {
            this.parseColor(color);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Standard preset colors
     */
    static PRESETS = {
        RED: 0xff0000,
        GREEN: 0x00ff00,
        BLUE: 0x0000ff,
        WHITE: 0xffffff,
        BLACK: 0x000000,
        GRAY: 0x808080,
        YELLOW: 0xffff00,
        CYAN: 0x00ffff,
        MAGENTA: 0xff00ff,
        MARS: 0x8B4513,
        MOON: 0xc0c0c0,
        ICE: 0xe0f6ff,
        VOLCANIC: 0x4d2608,
        DESERT: 0xd2b48c,
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ColorUtils;
}
