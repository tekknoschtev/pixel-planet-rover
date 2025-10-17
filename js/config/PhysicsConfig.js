/**
 * PhysicsConfig
 *
 * Centralized physics constants and configuration.
 * Extracted from RoverPhysics.js to reduce magic numbers.
 */

const PhysicsConfig = {
    // Gravity and damping
    gravity: -0.3,
    groundDamping: 0.7,
    airDamping: 0.99,

    // Rover dimensions
    wheelBase: 4,      // Distance between front and rear axles
    wheelTrack: 5,     // Distance between left and right wheels
    wheelRadius: 1,

    // Movement forces
    maxAcceleration: 0.2,
    maxBrakeForce: 0.15,
    maxTurnRate: 0.08,

    // Wheel contact
    wheelContactThreshold: 2.0,  // Distance to terrain before wheel is considered in contact
    wheelSuspensionTravel: 1.5,  // Max suspension compression

    // Friction
    staticFriction: 0.8,
    kineticFriction: 0.6,

    // Collision detection
    collisionBuffer: 0.5,  // Buffer zone around rover for collision detection

    /**
     * Validate configuration values
     * @returns {array} Array of validation errors, empty if valid
     */
    validate() {
        const errors = [];

        if (this.gravity >= 0) errors.push('gravity must be negative');
        if (this.groundDamping < 0 || this.groundDamping > 1) errors.push('groundDamping must be between 0 and 1');
        if (this.airDamping < 0 || this.airDamping > 1) errors.push('airDamping must be between 0 and 1');
        if (this.wheelBase <= 0) errors.push('wheelBase must be positive');
        if (this.wheelTrack <= 0) errors.push('wheelTrack must be positive');
        if (this.maxAcceleration <= 0) errors.push('maxAcceleration must be positive');

        return errors;
    },

    /**
     * Get rover half-dimensions
     */
    getRoverDimensions() {
        return {
            halfBase: this.wheelBase / 2,
            halfTrack: this.wheelTrack / 2,
            wheelRadius: this.wheelRadius,
        };
    },
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PhysicsConfig;
}
