// RoverPhysics.js - Handles rover physics, movement, and ground contact detection
class RoverPhysics {
    constructor() {
        // Physics variables
        this.roverVelocity = new THREE.Vector3(0, 0, 0); // Rover's current velocity
        this.roverPhysicsPosition = new THREE.Vector3(0, 80 + 20, 0); // Physics position (starts above surface)
        this.roverAngularVelocity = new THREE.Vector3(0, 0, 0); // Rover's rotational velocity
        this.gravity = -0.3; // Gravity acceleration (negative = downward) - reduced for better settling
        this.groundDamping = 0.7; // Energy loss when hitting ground (0-1) - increased for better settling
        this.airDamping = 0.99; // Air resistance (close to 1 = little resistance) - reduced air drag
        this.angularDamping = 0.95; // Rotational damping (prevents spinning)
        this.stabilityForce = 0.05; // How strongly rover tries to right itself
        this.isGrounded = false; // Is rover touching ground?

        // Terrain following variables
        this.roverRotation = { pitch: 0, roll: 0, yaw: -Math.PI / 2 }; // Initialize yaw to match north heading
        this.targetRotation = { pitch: 0, roll: 0, yaw: 0 };
        this.rotationLerpSpeed = 0.15; // How fast to interpolate (0-1, higher = faster)

        // Multi-point contact detection
        this.wheelOffsets = [
            { x: -2.5, z: 2, name: "front-left" },   // Front-left wheel
            { x: 2.5, z: 2, name: "front-right" },   // Front-right wheel
            { x: -2.5, z: -2, name: "rear-left" },   // Rear-left wheel
            { x: 2.5, z: -2, name: "rear-right" }    // Rear-right wheel
        ];
        this.wheelContacts = {
            "front-left": { height: 0, grounded: false },
            "front-right": { height: 0, grounded: false },
            "rear-left": { height: 0, grounded: false },
            "rear-right": { height: 0, grounded: false }
        };

        // Reference to terrain generator for surface height calculations
        this.terrainGenerator = null;
        this.planet = null;
        this.planetRadius = 80;
    }

    setReferences(terrainGenerator, planet, planetRadius) {
        this.terrainGenerator = terrainGenerator;
        this.planet = planet;
        this.planetRadius = planetRadius;
        // Reset rover physics position to start above the new planet surface
        this.roverPhysicsPosition.set(0, planetRadius + 20, 0);
    }

    lerp(start, end, factor) {
        return start + (end - start) * factor;
    }

    calculateWheelBasedRotation() {
        // Calculate rover orientation from wheel contact heights
        const frontLeftHeight = this.wheelContacts["front-left"].height;
        const frontRightHeight = this.wheelContacts["front-right"].height;
        const rearLeftHeight = this.wheelContacts["rear-left"].height;
        const rearRightHeight = this.wheelContacts["rear-right"].height;

        // Calculate average heights for front and rear
        const frontAverage = (frontLeftHeight + frontRightHeight) / 2;
        const rearAverage = (rearLeftHeight + rearRightHeight) / 2;

        // Calculate average heights for left and right
        const leftAverage = (frontLeftHeight + rearLeftHeight) / 2;
        const rightAverage = (frontRightHeight + rearRightHeight) / 2;

        // Calculate pitch from front-to-rear height difference
        const wheelBase = 4; // Distance between front and rear wheels (2 + 2)
        const pitch = Math.atan2(frontAverage - rearAverage, wheelBase);

        // Calculate roll from left-to-right height difference
        const wheelTrack = 5; // Distance between left and right wheels (2.5 + 2.5)
        const roll = Math.atan2(rightAverage - leftAverage, wheelTrack);

        return {
            pitch: pitch * 0.8, // Dampen the effect for stability
            roll: roll * 0.8,   // Dampen the effect for stability
            yaw: 0
        };
    }

    calculateTerrainRotation(surfaceNormal) {
        // Legacy function - kept for fallback
        // Surface normal is already in local rover space from our height sampling method

        // Calculate pitch (forward/backward tilt)
        // When surface slopes up toward +Z (forward), rover should pitch up (negative pitch)
        const pitch = -Math.atan2(surfaceNormal.z, surfaceNormal.y);

        // Calculate roll (left/right tilt)
        // When surface slopes up toward +X (right), rover should roll right (positive roll)
        const roll = Math.atan2(surfaceNormal.x, surfaceNormal.y);

        return {
            pitch: pitch * 0.8, // Increase tilt intensity to make effect more visible
            roll: roll * 0.8,   // Increase tilt intensity to make effect more visible
            yaw: 0
        };
    }

    updateWheelContactsAndOrientation() {
        if (!this.terrainGenerator || !this.planet) return;

        // Get ground heights at each wheel position (ignoring current rover rotation)
        const wheelHeights = {};

        this.wheelOffsets.forEach(wheel => {
            // Calculate wheel position relative to rover center (in local coordinates)
            const wheelWorldX = this.roverPhysicsPosition.x + wheel.x * Math.cos(this.roverRotation.yaw) - wheel.z * Math.sin(this.roverRotation.yaw);
            const wheelWorldZ = this.roverPhysicsPosition.z + wheel.x * Math.sin(this.roverRotation.yaw) + wheel.z * Math.cos(this.roverRotation.yaw);

            // Get ground height at this wheel position
            const groundHeight = this.terrainGenerator.getSurfaceHeightAtPosition(wheelWorldX, wheelWorldZ, this.planet, this.planetRadius);
            wheelHeights[wheel.name] = groundHeight;

            // Update wheel contact info
            this.wheelContacts[wheel.name].height = groundHeight + 1.0; // Rover center height when wheel touches
            this.wheelContacts[wheel.name].grounded = this.roverPhysicsPosition.y <= groundHeight + 1.8; // More generous tolerance for contact detection
        });

        // Calculate natural rover orientation from ground heights
        const frontLeftH = wheelHeights["front-left"];
        const frontRightH = wheelHeights["front-right"];
        const rearLeftH = wheelHeights["rear-left"];
        const rearRightH = wheelHeights["rear-right"];

        // Calculate pitch from front-to-rear slope
        const frontAvg = (frontLeftH + frontRightH) / 2;
        const rearAvg = (rearLeftH + rearRightH) / 2;
        const wheelBase = 4; // Distance between front and rear axles
        const targetPitch = Math.atan2(frontAvg - rearAvg, wheelBase) * 0.7; // Dampen for stability

        // Calculate roll from left-to-right slope
        const leftAvg = (frontLeftH + rearLeftH) / 2;
        const rightAvg = (frontRightH + rearRightH) / 2;
        const wheelTrack = 5; // Distance between left and right wheels
        const targetRoll = Math.atan2(rightAvg - leftAvg, wheelTrack) * 0.7; // Dampen for stability

        // Apply gravitational torque for realistic tilting
        this.applyGravitationalTorque(wheelHeights);

        // Apply rotation smoothly but responsively
        if (this.isGrounded) {
            const responsiveness = 0.3; // How quickly rover follows terrain (higher = more responsive)
            this.roverRotation.pitch = this.lerp(this.roverRotation.pitch, targetPitch, responsiveness);
            this.roverRotation.roll = this.lerp(this.roverRotation.roll, targetRoll, responsiveness);
        }
    }

    applyGravitationalTorque(wheelHeights) {
        // Get grounded wheel positions in world space
        const groundedWheelPositions = [];

        this.wheelOffsets.forEach(wheel => {
            if (this.wheelContacts[wheel.name].grounded) {
                // Transform wheel position to world coordinates
                const wheelWorldX = this.roverPhysicsPosition.x + wheel.x * Math.cos(this.roverRotation.yaw) - wheel.z * Math.sin(this.roverRotation.yaw);
                const wheelWorldZ = this.roverPhysicsPosition.z + wheel.x * Math.sin(this.roverRotation.yaw) + wheel.z * Math.cos(this.roverRotation.yaw);
                groundedWheelPositions.push({ x: wheelWorldX, z: wheelWorldZ, localX: wheel.x, localZ: wheel.z });
            }
        });

        // Need at least one contact point for stability analysis
        if (groundedWheelPositions.length === 0) return;

        // Calculate center of mass projection onto ground plane
        const centerOfMassLocal = { x: 0, z: 0 }; // Rover center of mass is at geometric center

        // Check if center of mass is supported by contact points
        const isStable = this.isCenterOfMassSupported(centerOfMassLocal, groundedWheelPositions);

        if (!isStable) {
            // Calculate torque direction to tip rover toward stability
            const stabilityTorque = this.calculateStabilityTorque(centerOfMassLocal, groundedWheelPositions);

            // Apply the torque
            const torqueStrength = 0.12; // Increased for more decisive tipping
            this.roverAngularVelocity.x += stabilityTorque.pitch * torqueStrength;
            this.roverAngularVelocity.z += stabilityTorque.roll * torqueStrength;
        }

        // Apply angular damping
        this.roverAngularVelocity.multiplyScalar(this.angularDamping);

        // Apply angular velocity to rover rotation
        this.roverRotation.pitch += this.roverAngularVelocity.x * 0.03;
        this.roverRotation.roll += this.roverAngularVelocity.z * 0.03;

        // Limit extreme rotations
        this.roverRotation.pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.roverRotation.pitch));
        this.roverRotation.roll = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.roverRotation.roll));
    }

    isCenterOfMassSupported(centerOfMass, contactPoints) {
        if (contactPoints.length === 0) return false;
        if (contactPoints.length === 1) return false; // Single point can't provide stability
        if (contactPoints.length === 2) {
            // Two points: stable only if center of mass is between them
            const p1 = contactPoints[0];
            const p2 = contactPoints[1];

            // Check if center of mass is on the line between the two points (with tolerance)
            const tolerance = 1.5; // Allow some distance from the line
            const distanceFromLine = this.distancePointToLine(centerOfMass, p1, p2);
            return distanceFromLine < tolerance;
        }

        // 3+ points: use polygon containment
        return this.isPointInPolygon(centerOfMass, contactPoints);
    }

    calculateStabilityTorque(centerOfMass, contactPoints) {
        // Calculate the direction the rover needs to tip to become stable
        const torque = { pitch: 0, roll: 0 };

        if (contactPoints.length === 1) {
            // Single contact point - tip toward center
            const contact = contactPoints[0];
            torque.pitch = centerOfMass.z - contact.localZ > 0 ? -1 : 1;
            torque.roll = centerOfMass.x - contact.localX > 0 ? -1 : 1;
        } else if (contactPoints.length === 2) {
            // Two contact points - tip perpendicular to the line between them
            const p1 = contactPoints[0];
            const p2 = contactPoints[1];

            // Calculate perpendicular direction from line to center of mass
            const lineVec = { x: p2.localX - p1.localX, z: p2.localZ - p1.localZ };
            const perpendicular = { x: -lineVec.z, z: lineVec.x }; // 90-degree rotation

            // Normalize and apply
            const length = Math.sqrt(perpendicular.x * perpendicular.x + perpendicular.z * perpendicular.z);
            if (length > 0) {
                torque.roll = (perpendicular.x / length) * 0.5;
                torque.pitch = -(perpendicular.z / length) * 0.5;
            }
        }

        return torque;
    }

    distancePointToLine(point, lineStart, lineEnd) {
        const A = point.x - lineStart.localX;
        const B = point.z - lineStart.localZ;
        const C = lineEnd.localX - lineStart.localX;
        const D = lineEnd.localZ - lineStart.localZ;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;

        if (lenSq === 0) return Math.sqrt(A * A + B * B);

        const param = dot / lenSq;
        let xx, zz;

        if (param < 0) {
            xx = lineStart.localX;
            zz = lineStart.localZ;
        } else if (param > 1) {
            xx = lineEnd.localX;
            zz = lineEnd.localZ;
        } else {
            xx = lineStart.localX + param * C;
            zz = lineStart.localZ + param * D;
        }

        const dx = point.x - xx;
        const dz = point.z - zz;
        return Math.sqrt(dx * dx + dz * dz);
    }

    isPointInPolygon(point, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            if (((polygon[i].localZ > point.z) !== (polygon[j].localZ > point.z)) &&
                (point.x < (polygon[j].localX - polygon[i].localX) * (point.z - polygon[i].localZ) / (polygon[j].localZ - polygon[i].localZ) + polygon[i].localX)) {
                inside = !inside;
            }
        }
        return inside;
    }

    getLowestPossibleContactHeight() {
        // Get the highest ground height under any wheel (lowest rover position needed for contact)
        const allWheelHeights = Object.values(this.wheelContacts).map(contact => contact.height);
        return allWheelHeights.length > 0 ? Math.max(...allWheelHeights) : null;
    }

    calculateGroundContact() {
        const groundedWheels = Object.values(this.wheelContacts).filter(contact => contact.grounded);
        const anyGrounded = groundedWheels.length > 0;

        let lowestContactHeight = null;
        if (anyGrounded) {
            lowestContactHeight = Math.max(...groundedWheels.map(contact => contact.height));
        }

        return { anyGrounded, lowestContactHeight, groundedCount: groundedWheels.length };
    }

    updatePhysics() {
        // Apply gravity acceleration
        this.roverVelocity.y += this.gravity;

        // Apply air resistance
        this.roverVelocity.multiplyScalar(this.airDamping);

        // Apply settling assistance - extra downward force when close to ground
        const settlingDistance = 3.0; // Distance within which settling assistance applies
        const lowestPossibleContact = this.getLowestPossibleContactHeight();
        if (lowestPossibleContact !== null) {
            const distanceToGround = this.roverPhysicsPosition.y - lowestPossibleContact;
            if (distanceToGround > 0 && distanceToGround < settlingDistance) {
                // Apply gentle settling force
                const settlingForce = -0.1 * (1 - distanceToGround / settlingDistance);
                this.roverVelocity.y += settlingForce;
            }
        }

        // Update physics position with velocity
        this.roverPhysicsPosition.add(this.roverVelocity);

        // Check ground contact for each wheel and update rover orientation naturally
        this.updateWheelContactsAndOrientation();

        // Determine overall ground contact and lowest contact point
        const contactResults = this.calculateGroundContact();
        const wasGrounded = this.isGrounded;
        this.isGrounded = contactResults.anyGrounded;

        if (contactResults.lowestContactHeight !== null) {
            const groundDistance = this.roverPhysicsPosition.y - contactResults.lowestContactHeight;

            if (groundDistance <= 0.2) { // Close enough to ground to be considered "touching"
                // Settle rover onto ground
                this.roverPhysicsPosition.y = contactResults.lowestContactHeight;

                // Apply bounce/damping to vertical velocity
                if (this.roverVelocity.y < 0) { // Only if moving downward
                    this.roverVelocity.y *= -this.groundDamping; // Reverse and reduce velocity

                    // Stop very small bounces - be more aggressive about settling
                    if (Math.abs(this.roverVelocity.y) < 0.05) {
                        this.roverVelocity.y = 0;
                    }
                }

                // If rover is very close to settled, snap it down
                if (Math.abs(groundDistance) < 0.05 && Math.abs(this.roverVelocity.y) < 0.02) {
                    this.roverPhysicsPosition.y = contactResults.lowestContactHeight;
                    this.roverVelocity.y = 0;
                }
            }
        }

        return {
            wasGrounded: wasGrounded,
            isGrounded: this.isGrounded,
            contactResults: contactResults,
            landingImpact: wasGrounded !== this.isGrounded ? Math.abs(this.roverVelocity.y) : 0
        };
    }

    // Movement handling
    handleMovement(keys, roverHeading, planetQuaternion, planetRadius) {
        // Scale movement speed inversely with planet radius for consistent surface speed
        const baseRadius = 80; // Reference radius for speed calibration
        const moveSpeed = 0.01 * (baseRadius / planetRadius);
        const turnSpeed = 0.03;
        let moved = false;
        let forwardMovement = false; // Track if rover is actually moving forward/backward

        // Simple tank controls: A/D turn, W/S move forward/backward
        if (keys['KeyA']) {
            this.roverRotation.yaw += turnSpeed; // Turn left
            moved = true;
        }
        if (keys['KeyD']) {
            this.roverRotation.yaw -= turnSpeed; // Turn right
            moved = true;
        }

        // Movement using quaternion rotation to avoid gimbal lock
        if (keys['KeyW']) {
            // Forward movement - rotation axis perpendicular to heading direction
            const rotationAxis = new THREE.Vector3(Math.cos(roverHeading), 0, Math.sin(roverHeading));
            const rotationQuaternion = new THREE.Quaternion();
            rotationQuaternion.setFromAxisAngle(rotationAxis, -moveSpeed); // Flip sign
            planetQuaternion.multiplyQuaternions(rotationQuaternion, planetQuaternion);
            moved = true;
            forwardMovement = true;
        }
        if (keys['KeyS']) {
            // Backward movement - opposite of forward
            const rotationAxis = new THREE.Vector3(Math.cos(roverHeading), 0, Math.sin(roverHeading));
            const rotationQuaternion = new THREE.Quaternion();
            rotationQuaternion.setFromAxisAngle(rotationAxis, moveSpeed); // Flip sign
            planetQuaternion.multiplyQuaternions(rotationQuaternion, planetQuaternion);
            moved = true;
            forwardMovement = true;
        }

        return { moved, forwardMovement };
    }

    // Get rover state for other systems
    getRoverState() {
        return {
            position: this.roverPhysicsPosition.clone(),
            velocity: this.roverVelocity.clone(),
            rotation: { ...this.roverRotation },
            isGrounded: this.isGrounded,
            wheelContacts: { ...this.wheelContacts }
        };
    }

    // Update heading for display purposes
    updateHeading(newHeading) {
        this.roverRotation.yaw = this.lerp(this.roverRotation.yaw, -newHeading, this.rotationLerpSpeed);
    }
}

// Export for global use
window.RoverPhysics = RoverPhysics;