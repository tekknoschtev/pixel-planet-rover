// ParticleSystem.js - Handles dust and ambient particle systems
class ParticleSystem {
    constructor() {
        // Particle system variables
        this.dustParticleSystem = null;
        this.dustParticles = [];
        this.maxDustParticles = 50;
        this.lastRoverMovement = 0;
        this.lastLandingTime = 0;

        // Ambient atmospheric particle system variables
        this.ambientParticles = [];
        this.maxAmbientParticles = 30;

        // References to game objects
        this.scene = null;
        this.planetQuaternion = null;
        this.planetRadius = 80;
    }

    setReferences(scene, planetQuaternion, planetRadius) {
        this.scene = scene;
        this.planetQuaternion = planetQuaternion;
        this.planetRadius = planetRadius;
    }

    createDustParticleSystem() {
        // Clear any existing dust particles
        this.dustParticles.forEach(particle => {
            if (particle.mesh) {
                this.scene.remove(particle.mesh);
            }
        });
        this.dustParticles = [];

        // Create particle pool
        for (let i = 0; i < this.maxDustParticles; i++) {
            const particleGeometry = new THREE.SphereGeometry(1.0, 6, 6); // Larger base size
            const particleMaterial = new THREE.MeshBasicMaterial({
                color: 0xD2B48C, // Sandy brown color like original
                transparent: true,
                opacity: 0.7
            });

            const particleMesh = new THREE.Mesh(particleGeometry, particleMaterial);
            particleMesh.visible = false;
            this.scene.add(particleMesh);

            this.dustParticles.push({
                mesh: particleMesh,
                position: new THREE.Vector3(),
                velocity: new THREE.Vector3(),
                life: 0,
                maxLife: 1.0,
                size: 0.3 + Math.random() * 0.5, // Variable size 0.3-0.8
                alpha: 1.0,
                planetRotationAtSpawn: new THREE.Quaternion()
            });
        }

        console.log('Created dust particle system with', this.maxDustParticles, 'particles');
    }

    spawnDustParticles(position, velocity, count = 5) {
        // Find available particles
        for (let i = 0; i < count && i < this.maxDustParticles; i++) {
            // Find first dead particle
            const deadParticleIndex = this.dustParticles.findIndex(p => p.life <= 0);
            if (deadParticleIndex === -1) break;

            const particle = this.dustParticles[deadParticleIndex];

            // Convert world position to planet-local coordinates
            const localPosition = position.clone();
            localPosition.x += (Math.random() - 0.5) * 4; // Spread around rover
            localPosition.z += (Math.random() - 0.5) * 4;

            // Convert to planet-local coordinates by applying inverse planet rotation
            const inverseQuaternion = this.planetQuaternion.clone().invert();
            localPosition.applyQuaternion(inverseQuaternion);

            // Set particle properties in planet-local space
            particle.position.copy(localPosition);

            // Convert velocity to planet-local space as well
            const localVelocity = velocity.clone();
            localVelocity.x += (Math.random() - 0.5) * 0.5; // More sideways spread for movement
            localVelocity.y += Math.random() * 0.8 + 0.2; // More upward motion for visible arcs
            localVelocity.z += (Math.random() - 0.5) * 0.5; // More sideways spread
            localVelocity.applyQuaternion(inverseQuaternion);

            particle.velocity.copy(localVelocity);
            particle.life = 0.8; // Much shorter life for more realistic dust
            particle.maxLife = 0.8;
            particle.size = 0.3 + Math.random() * 0.5; // Much smaller size variation
            particle.alpha = 0.8;
            particle.planetRotationAtSpawn.copy(this.planetQuaternion); // Store current planet rotation
        }
    }

    updateDustParticles() {
        let aliveParticles = 0;
        for (let i = 0; i < this.dustParticles.length; i++) {
            const particle = this.dustParticles[i];

            if (particle.life > 0) {
                aliveParticles++;

                // Update physics in planet-local space with gravitational pull toward planet center

                // Calculate distance from planet center
                const distanceFromCenter = particle.position.length();

                // Apply gentler radial gravity toward planet center (simulates planetary gravity)
                if (distanceFromCenter > this.planetRadius + 5) { // Only apply when significantly above surface
                    const gravityDirection = particle.position.clone().normalize().multiplyScalar(-1);
                    const gravityStrength = 0.02; // Much gentler gravity
                    const gravityForce = gravityDirection.multiplyScalar(gravityStrength);
                    particle.velocity.add(gravityForce);
                }

                // Apply gentler air resistance
                particle.velocity.multiplyScalar(0.96); // Less air resistance for more movement

                // Update position
                particle.position.add(particle.velocity);

                // Gentler surface interaction - only when very close to surface
                const surfaceDistance = distanceFromCenter - this.planetRadius;
                if (surfaceDistance < 1) { // Within 1 unit of surface
                    // Soft bounce with less energy loss
                    const surfaceNormal = particle.position.clone().normalize();
                    const velocityDotNormal = particle.velocity.dot(surfaceNormal);

                    if (velocityDotNormal < 0) { // Moving toward surface
                        // Gentler reflection with less damping
                        const reflection = surfaceNormal.multiplyScalar(velocityDotNormal * 2);
                        particle.velocity.sub(reflection);
                        particle.velocity.multiplyScalar(0.7); // Less energy loss on bounce

                        // Push particle slightly away from surface
                        particle.position.normalize().multiplyScalar(this.planetRadius + 1.5);
                    }
                }

                // Update life
                particle.life -= 0.016; // ~60fps frame time

                // Calculate fade alpha
                const fadeAlpha = Math.max(0, particle.life / particle.maxLife);

                // Convert planet-local position to world position by applying current planet rotation
                const worldPosition = particle.position.clone();
                worldPosition.applyQuaternion(this.planetQuaternion);

                // Update mesh position and visibility
                particle.mesh.position.copy(worldPosition);
                particle.mesh.visible = true;
                particle.mesh.material.opacity = fadeAlpha * 0.8;

                // Scale particle as it fades - original larger scale
                const scale = particle.size * (0.5 + fadeAlpha * 0.8);
                particle.mesh.scale.setScalar(scale);
            } else {
                // Hide dead particles
                particle.mesh.visible = false;
                particle.mesh.position.set(0, -1000, 0);
            }
        }

        // Optional debug logging (removed for cleaner console)
    }

    createAmbientParticleSystem() {
        // Clear any existing ambient particles
        this.ambientParticles.forEach(particle => {
            if (particle.mesh) {
                this.scene.remove(particle.mesh);
            }
        });
        this.ambientParticles = [];

        // Create ambient atmospheric particles
        for (let i = 0; i < this.maxAmbientParticles; i++) {
            const particleGeometry = new THREE.SphereGeometry(0.8, 6, 6); // Much larger
            const particleMaterial = new THREE.MeshBasicMaterial({
                color: 0xE6E6FA, // Light lavender like original atmospheric particles
                transparent: true,
                opacity: 0.15
            });

            const particleMesh = new THREE.Mesh(particleGeometry, particleMaterial);

            // Random position around planet
            const distance = this.planetRadius + 20 + Math.random() * 40;
            const lat = (Math.random() - 0.5) * Math.PI;
            const lon = Math.random() * Math.PI * 2;

            const x = distance * Math.cos(lat) * Math.cos(lon);
            const y = distance * Math.sin(lat);
            const z = distance * Math.cos(lat) * Math.sin(lon);

            particleMesh.position.set(x, y, z);
            this.scene.add(particleMesh);

            this.ambientParticles.push({
                mesh: particleMesh,
                position: new THREE.Vector3(x, y, z),
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.1,
                    (Math.random() - 0.5) * 0.05,
                    (Math.random() - 0.5) * 0.1
                ),
                time: Math.random() * Math.PI * 2,
                bobOffset: Math.random() * Math.PI * 2,
                bobHeight: 0.5 + Math.random() * 1.0,
                baseOpacity: 0.1 + Math.random() * 0.15 // Lower base opacity for subtlety
            });
        }

        console.log('Created ambient particle system with', this.maxAmbientParticles, 'particles');
    }

    updateAmbientParticles() {
        const deltaTime = 0.016; // ~60fps

        for (let i = 0; i < this.ambientParticles.length; i++) {
            const particle = this.ambientParticles[i];
            particle.time += deltaTime;

            // Gentle horizontal drift
            particle.position.add(particle.velocity);

            // Vertical bobbing motion
            const bobOffset = Math.sin(particle.time * 2 + particle.bobOffset) * particle.bobHeight * deltaTime;
            particle.position.y += bobOffset;

            // Keep particles within bounds (sphere around planet)
            const distanceFromCenter = particle.position.length();
            const minDistance = this.planetRadius + 8;
            const maxDistance = this.planetRadius + 60;

            if (distanceFromCenter < minDistance) {
                particle.position.normalize().multiplyScalar(minDistance);
            } else if (distanceFromCenter > maxDistance) {
                particle.position.normalize().multiplyScalar(maxDistance);
            }

            // Gentle random velocity changes for organic movement
            if (Math.random() < 0.01) { // 1% chance per frame to change direction slightly
                particle.velocity.add(new THREE.Vector3(
                    (Math.random() - 0.5) * 0.01,
                    (Math.random() - 0.5) * 0.005,
                    (Math.random() - 0.5) * 0.01
                ));

                // Clamp velocity to reasonable limits
                const maxVel = 0.15;
                if (particle.velocity.length() > maxVel) {
                    particle.velocity.normalize().multiplyScalar(maxVel);
                }
            }

            // Apply planet rotation to particle position
            const worldPosition = particle.position.clone();
            worldPosition.applyQuaternion(this.planetQuaternion);
            particle.mesh.position.copy(worldPosition);

            // Keep particles at consistent opacity for better atmospheric visibility
            particle.mesh.material.opacity = particle.baseOpacity;
        }
    }

    // Spawn dust from rover movement
    spawnMovementDust(roverPhysicsPosition, roverRotation, roverHeading, isGrounded) {
        if (!isGrounded || Date.now() - this.lastRoverMovement < 150) return;

        // Spawn particles from rear wheel positions for proper trail effect
        const rearLeftWheel = new THREE.Vector3(-2.5, 0, -2); // Local wheel position
        const rearRightWheel = new THREE.Vector3(2.5, 0, -2); // Local wheel position

        // Transform wheel positions to world space based on rover rotation
        const cosYaw = Math.cos(roverRotation.yaw);
        const sinYaw = Math.sin(roverRotation.yaw);

        // Left wheel world position
        const leftWheelWorld = new THREE.Vector3(
            roverPhysicsPosition.x + rearLeftWheel.x * cosYaw - rearLeftWheel.z * sinYaw,
            roverPhysicsPosition.y - 1, // Lower to ground level
            roverPhysicsPosition.z + rearLeftWheel.x * sinYaw + rearLeftWheel.z * cosYaw
        );

        // Right wheel world position
        const rightWheelWorld = new THREE.Vector3(
            roverPhysicsPosition.x + rearRightWheel.x * cosYaw - rearRightWheel.z * sinYaw,
            roverPhysicsPosition.y - 1, // Lower to ground level
            roverPhysicsPosition.z + rearRightWheel.x * sinYaw + rearRightWheel.z * cosYaw
        );

        const movementVelocity = new THREE.Vector3(
            Math.sin(roverHeading) * 0.15, // Reduced motion
            0.08, // Even less upward motion
            -Math.cos(roverHeading) * 0.15 // Reduced backward motion
        );

        // Spawn particles from both rear wheels
        this.spawnDustParticles(leftWheelWorld, movementVelocity, 1);
        this.spawnDustParticles(rightWheelWorld, movementVelocity, 1);

        this.lastRoverMovement = Date.now();
    }

    // Spawn dust from landing
    spawnLandingDust(roverPhysicsPosition, landingImpact) {
        if (landingImpact > 0.3) {
            // Rover just landed with significant impact - reduced particle count
            this.spawnDustParticles(
                roverPhysicsPosition.clone(),
                new THREE.Vector3(0, landingImpact * 0.5, 0), // Much less upward velocity
                Math.min(Math.floor(landingImpact * 5) + 1, 4) // Fewer particles, max 4
            );
            this.lastLandingTime = Date.now();
        }
    }

    // Update all particle systems
    update() {
        this.updateDustParticles();
        this.updateAmbientParticles();
    }

    // Cleanup method
    cleanupParticles() {
        // Remove all particles from scene
        [...this.dustParticles, ...this.ambientParticles].forEach(particle => {
            if (particle.mesh) {
                this.scene.remove(particle.mesh);
            }
        });

        this.dustParticles = [];
        this.ambientParticles = [];
    }
}

// Export for global use
window.ParticleSystem = ParticleSystem;