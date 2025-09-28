// MobileInputHandler.js - Handles touch input for mobile devices
class MobileInputHandler {
    constructor() {
        // Touch state tracking
        this.touches = new Map();
        this.lastTouchTime = 0;
        this.doubleTapThreshold = 300; // ms

        // Screen zones
        this.screenWidth = window.innerWidth;
        this.screenHeight = window.innerHeight;

        // Virtual joystick configuration (bottom-right)
        this.joystick = {
            size: 120, // Total joystick diameter
            knobSize: 50, // Draggable knob diameter
            margin: 30, // Distance from screen edges
            centerX: 0, // Will be calculated
            centerY: 0, // Will be calculated
            active: false,
            knobX: 0, // Current knob position
            knobY: 0,
            startX: 0, // Touch start position
            startY: 0,
            deadZone: 15 // Center area with no input
        };

        this.updateJoystickPosition();

        // Rover movement state (now controlled by joystick)
        this.roverInputState = {
            forward: false,
            backward: false,
            turnLeft: false,
            turnRight: false,
            // Analog values from joystick (0-1)
            forwardIntensity: 0,
            backwardIntensity: 0,
            turnLeftIntensity: 0,
            turnRightIntensity: 0
        };

        // Camera state
        this.cameraInputState = {
            orbiting: false,
            lastOrbitPosition: { x: 0, y: 0 },
            zooming: false,
            lastPinchDistance: 0
        };

        // Visual feedback elements
        this.visualFeedback = {
            roverTouchIndicator: null,
            cameraTouchIndicator: null
        };

        this.createVisualFeedback();
        this.setupTouchEvents();

        // Handle window resize
        window.addEventListener('resize', () => {
            this.screenWidth = window.innerWidth;
            this.screenHeight = window.innerHeight;
            this.updateJoystickPosition();
        });
    }

    static isMobileDevice() {
        // More conservative mobile detection - prioritize user agent detection
        const userAgentMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        // Only use touch detection if user agent suggests mobile
        if (userAgentMobile) {
            return true;
        }

        // Additional check for touch devices, but be more conservative
        const hasTouchScreen = ('ontouchstart' in window) && (navigator.maxTouchPoints > 0);
        const isSmallScreen = window.innerWidth <= 768; // Tablet/phone size

        return hasTouchScreen && isSmallScreen;
    }

    updateJoystickPosition() {
        // Position joystick in bottom-right corner
        this.joystick.centerX = this.screenWidth - this.joystick.size/2 - this.joystick.margin;
        this.joystick.centerY = this.screenHeight - this.joystick.size/2 - this.joystick.margin;

        // Reset knob to center when screen resizes
        this.joystick.knobX = this.joystick.centerX;
        this.joystick.knobY = this.joystick.centerY;
    }

    isPointInJoystick(x, y) {
        const dx = x - this.joystick.centerX;
        const dy = y - this.joystick.centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance <= this.joystick.size / 2;
    }

    createVisualFeedback() {
        // Create subtle visual indicators for touch zones (only visible during touch)
        const style = document.createElement('style');
        style.textContent = `
            .virtual-joystick {
                position: fixed;
                pointer-events: none;
                z-index: 1000;
                opacity: 1;
            }

            .joystick-base {
                position: fixed;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.2);
                border: 4px solid rgba(255, 255, 255, 0.5);
                transform: translate(-50%, -50%);
                box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.3);
            }

            .joystick-knob {
                position: fixed;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.8);
                border: 3px solid rgba(255, 255, 255, 1);
                transform: translate(-50%, -50%);
                transition: all 0.1s ease-out;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
            }

            .joystick-knob.active {
                background: rgba(255, 200, 100, 0.8);
                border-color: rgba(255, 200, 100, 1);
                box-shadow: 0 0 10px rgba(255, 200, 100, 0.5);
            }

            .camera-touch-indicator {
                position: fixed;
                border-radius: 50%;
                background: rgba(100, 150, 255, 0.3);
                border: 2px solid rgba(100, 150, 255, 0.6);
                pointer-events: none;
                z-index: 999;
                transform: translate(-50%, -50%);
                transition: opacity 0.2s ease-out;
                opacity: 0;
                width: 40px;
                height: 40px;
            }

            .camera-touch-indicator.active {
                opacity: 1;
            }
        `;
        document.head.appendChild(style);

        // Create virtual joystick elements
        this.visualFeedback.joystickContainer = document.createElement('div');
        this.visualFeedback.joystickContainer.className = 'virtual-joystick';
        document.body.appendChild(this.visualFeedback.joystickContainer);

        // Joystick base (outer ring)
        this.visualFeedback.joystickBase = document.createElement('div');
        this.visualFeedback.joystickBase.className = 'joystick-base';
        this.visualFeedback.joystickBase.style.width = this.joystick.size + 'px';
        this.visualFeedback.joystickBase.style.height = this.joystick.size + 'px';
        this.visualFeedback.joystickContainer.appendChild(this.visualFeedback.joystickBase);

        // Joystick knob (inner moveable part)
        this.visualFeedback.joystickKnob = document.createElement('div');
        this.visualFeedback.joystickKnob.className = 'joystick-knob';
        this.visualFeedback.joystickKnob.style.width = this.joystick.knobSize + 'px';
        this.visualFeedback.joystickKnob.style.height = this.joystick.knobSize + 'px';
        this.visualFeedback.joystickContainer.appendChild(this.visualFeedback.joystickKnob);

        // Camera touch indicator
        this.visualFeedback.cameraTouchIndicator = document.createElement('div');
        this.visualFeedback.cameraTouchIndicator.className = 'camera-touch-indicator';
        document.body.appendChild(this.visualFeedback.cameraTouchIndicator);

        this.updateJoystickVisuals();

        // Debug: Log joystick creation
        console.log('Mobile joystick created at:', {
            centerX: this.joystick.centerX,
            centerY: this.joystick.centerY,
            size: this.joystick.size
        });
    }

    updateJoystickVisuals() {
        // Position joystick base
        this.visualFeedback.joystickBase.style.left = this.joystick.centerX + 'px';
        this.visualFeedback.joystickBase.style.top = this.joystick.centerY + 'px';

        // Position joystick knob
        this.visualFeedback.joystickKnob.style.left = this.joystick.knobX + 'px';
        this.visualFeedback.joystickKnob.style.top = this.joystick.knobY + 'px';

        // Show/hide joystick based on active state
        if (this.joystick.active) {
            this.visualFeedback.joystickKnob.classList.add('active');
        } else {
            this.visualFeedback.joystickKnob.classList.remove('active');
        }
    }

    setupTouchEvents() {
        // Only set up touch events if this is actually a mobile device
        if (!MobileInputHandler.isMobileDevice()) {
            return;
        }

        // Prevent default touch behaviors
        document.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        document.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        document.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
        document.addEventListener('touchcancel', (e) => this.handleTouchEnd(e), { passive: false });

        // Prevent context menu on mobile only
        document.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    handleTouchStart(event) {
        event.preventDefault();

        for (let touch of event.changedTouches) {
            const isJoystickTouch = this.isPointInJoystick(touch.clientX, touch.clientY);

            this.touches.set(touch.identifier, {
                x: touch.clientX,
                y: touch.clientY,
                startX: touch.clientX,
                startY: touch.clientY,
                startTime: Date.now(),
                isJoystick: isJoystickTouch,
                isCamera: !isJoystickTouch
            });

            // Start joystick interaction if touch is in joystick area
            if (isJoystickTouch && !this.joystick.active) {
                this.joystick.active = true;
                this.joystick.touchId = touch.identifier;
                this.joystick.startX = touch.clientX;
                this.joystick.startY = touch.clientY;
            }
        }

        this.processTouchInput();
        this.updateVisualFeedback();
    }

    handleTouchMove(event) {
        event.preventDefault();

        for (let touch of event.changedTouches) {
            if (this.touches.has(touch.identifier)) {
                const touchData = this.touches.get(touch.identifier);
                touchData.x = touch.clientX;
                touchData.y = touch.clientY;
                this.touches.set(touch.identifier, touchData);
            }
        }

        this.processTouchInput();
        this.updateVisualFeedback();
    }

    handleTouchEnd(event) {
        event.preventDefault();

        for (let touch of event.changedTouches) {
            const touchData = this.touches.get(touch.identifier);
            if (touchData) {
                // End joystick interaction if this was the joystick touch
                if (this.joystick.active && this.joystick.touchId === touch.identifier) {
                    this.joystick.active = false;
                    this.joystick.touchId = null;
                    // Reset knob to center
                    this.joystick.knobX = this.joystick.centerX;
                    this.joystick.knobY = this.joystick.centerY;
                }

                this.handleTouchEndLogic(touchData);
                this.touches.delete(touch.identifier);
            }
        }

        this.processTouchInput();
        this.updateVisualFeedback();
    }

    handleTouchEndLogic(touchData) {
        const touchDuration = Date.now() - touchData.startTime;
        const touchDistance = Math.sqrt(
            Math.pow(touchData.x - touchData.startX, 2) +
            Math.pow(touchData.y - touchData.startY, 2)
        );

        // Detect tap (short duration, minimal movement)
        if (touchDuration < 300 && touchDistance < 30) {
            this.handleTap(touchData);
        }
    }

    handleTap(touchData) {
        const currentTime = Date.now();

        // Check for double tap
        if (currentTime - this.lastTouchTime < this.doubleTapThreshold) {
            this.handleDoubleTap(touchData);
        } else {
            this.handleSingleTap(touchData);
        }

        this.lastTouchTime = currentTime;
    }

    handleSingleTap(touchData) {
        // Single tap outside joystick area doesn't do anything special now
        // Joystick handles rover movement
    }

    handleDoubleTap(touchData) {
        // Double tap anywhere (except joystick): center camera on rover
        if (!touchData.isJoystick && window.gameEngine && window.gameEngine.renderingEngine) {
            window.gameEngine.renderingEngine.cameraAngle.theta = 0;
            window.gameEngine.renderingEngine.cameraAngle.phi = 1.1;
            window.gameEngine.renderingEngine.updateCameraPosition();
        }
    }

    processTouchInput() {
        this.resetInputStates();

        const touchArray = Array.from(this.touches.values());
        const cameraTouches = touchArray.filter(t => t.isCamera);

        // Handle joystick input
        if (this.joystick.active) {
            this.processJoystickInput();
        }

        // Handle camera gestures (excluding joystick touches)
        if (cameraTouches.length === 2) {
            // Pinch zoom with two camera touches
            this.handlePinchZoom(cameraTouches);
        } else if (cameraTouches.length === 1) {
            // Single touch camera orbit
            this.processCameraTouch(cameraTouches[0]);
        }
    }

    processJoystickInput() {
        // Get the current joystick touch
        const joystickTouch = Array.from(this.touches.values()).find(t => t.isJoystick);
        if (!joystickTouch) return;

        // Calculate offset from joystick center
        const deltaX = joystickTouch.x - this.joystick.centerX;
        const deltaY = joystickTouch.y - this.joystick.centerY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        // Constrain knob to joystick boundary
        const maxDistance = this.joystick.size / 2 - this.joystick.knobSize / 2;
        if (distance > maxDistance) {
            const angle = Math.atan2(deltaY, deltaX);
            this.joystick.knobX = this.joystick.centerX + Math.cos(angle) * maxDistance;
            this.joystick.knobY = this.joystick.centerY + Math.sin(angle) * maxDistance;
        } else {
            this.joystick.knobX = joystickTouch.x;
            this.joystick.knobY = joystickTouch.y;
        }

        // Calculate input values if outside dead zone
        if (distance > this.joystick.deadZone) {
            const normalizedDistance = Math.min(distance, maxDistance) / maxDistance;

            // Y-axis: forward/backward (negative Y = forward)
            const forwardValue = Math.max(0, -deltaY / maxDistance);
            const backwardValue = Math.max(0, deltaY / maxDistance);

            // X-axis: turning (positive X = turn right)
            const turnRightValue = Math.max(0, deltaX / maxDistance);
            const turnLeftValue = Math.max(0, -deltaX / maxDistance);

            // Apply to rover input state
            this.roverInputState.forward = forwardValue > 0.1;
            this.roverInputState.backward = backwardValue > 0.1;
            this.roverInputState.turnRight = turnRightValue > 0.1;
            this.roverInputState.turnLeft = turnLeftValue > 0.1;

            // Store intensity values for future analog control
            this.roverInputState.forwardIntensity = forwardValue;
            this.roverInputState.backwardIntensity = backwardValue;
            this.roverInputState.turnRightIntensity = turnRightValue;
            this.roverInputState.turnLeftIntensity = turnLeftValue;
        }
    }

    processCameraTouch(touchData) {
        // Camera orbiting with single touch
        if (!this.cameraInputState.orbiting) {
            this.cameraInputState.orbiting = true;
            this.cameraInputState.lastOrbitPosition = { x: touchData.x, y: touchData.y };
        } else {
            const deltaX = touchData.x - this.cameraInputState.lastOrbitPosition.x;
            const deltaY = touchData.y - this.cameraInputState.lastOrbitPosition.y;

            // Apply camera rotation
            if (window.gameEngine && window.gameEngine.renderingEngine) {
                const renderingEngine = window.gameEngine.renderingEngine;
                renderingEngine.cameraAngle.theta -= deltaX * 0.01;
                renderingEngine.cameraAngle.phi += deltaY * 0.01;
                renderingEngine.cameraAngle.phi = Math.max(0.1, Math.min(Math.PI - 0.1, renderingEngine.cameraAngle.phi));
                renderingEngine.updateCameraPosition();
            }

            this.cameraInputState.lastOrbitPosition = { x: touchData.x, y: touchData.y };
        }
    }

    handlePinchZoom(touches) {
        const touch1 = touches[0];
        const touch2 = touches[1];

        const distance = Math.sqrt(
            Math.pow(touch2.x - touch1.x, 2) +
            Math.pow(touch2.y - touch1.y, 2)
        );

        if (!this.cameraInputState.zooming) {
            this.cameraInputState.zooming = true;
            this.cameraInputState.lastPinchDistance = distance;
        } else {
            const deltaDistance = distance - this.cameraInputState.lastPinchDistance;

            // Apply zoom
            if (window.gameEngine && window.gameEngine.renderingEngine) {
                const renderingEngine = window.gameEngine.renderingEngine;
                renderingEngine.cameraDistance -= deltaDistance * 0.1;
                renderingEngine.cameraDistance = Math.max(20, Math.min(150, renderingEngine.cameraDistance));
                renderingEngine.updateCameraPosition();
            }

            this.cameraInputState.lastPinchDistance = distance;
        }
    }

    resetInputStates() {
        this.roverInputState.forward = false;
        this.roverInputState.backward = false;
        this.roverInputState.turnLeft = false;
        this.roverInputState.turnRight = false;

        if (this.touches.size === 0) {
            this.cameraInputState.orbiting = false;
            this.cameraInputState.zooming = false;
        }
    }

    updateVisualFeedback() {
        // Update joystick visuals
        this.updateJoystickVisuals();

        // Update camera touch indicator
        const cameraTouches = Array.from(this.touches.values()).filter(t => t.isCamera);
        if (cameraTouches.length > 0) {
            const touch = cameraTouches[0];
            this.visualFeedback.cameraTouchIndicator.style.left = touch.x + 'px';
            this.visualFeedback.cameraTouchIndicator.style.top = touch.y + 'px';
            this.visualFeedback.cameraTouchIndicator.classList.add('active');
        } else {
            this.visualFeedback.cameraTouchIndicator.classList.remove('active');
        }
    }

    // Public API for getting input state
    getRoverInputState() {
        return { ...this.roverInputState };
    }

    getCameraInputState() {
        return { ...this.cameraInputState };
    }

    // Convert touch input to keyboard-like input for compatibility
    getTouchAsKeyboardInput() {
        return {
            'KeyW': this.roverInputState.forward,
            'KeyS': this.roverInputState.backward,
            'KeyA': this.roverInputState.turnLeft,
            'KeyD': this.roverInputState.turnRight
        };
    }
}

// Export for global use
window.MobileInputHandler = MobileInputHandler;