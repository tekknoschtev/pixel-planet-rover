// ToastManager.js - Toast Notification System
class ToastManager {
    constructor() {
        this.container = document.getElementById('toastContainer');
        this.toasts = new Map();
        this.toastCounter = 0;
    }

    show(message, type = 'info', duration = 4000) {
        const toastId = ++this.toastCounter;

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            ${message}
            <button class="toast-close" onclick="window.toastManager.close(${toastId})">&times;</button>
        `;

        // Add to container
        this.container.appendChild(toast);
        this.toasts.set(toastId, toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Auto-remove after duration
        if (duration > 0) {
            setTimeout(() => {
                this.close(toastId);
            }, duration);
        }

        return toastId;
    }

    close(toastId) {
        const toast = this.toasts.get(toastId);
        if (toast) {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
                this.toasts.delete(toastId);
            }, 300); // Match CSS transition duration
        }
    }

    success(message, duration = 4000) {
        return this.show(message, 'success', duration);
    }

    error(message, duration = 5000) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration = 4000) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration = 4000) {
        return this.show(message, 'info', duration);
    }
}

// Custom confirmation dialog
function showConfirmDialog(message, onConfirm, onCancel = null) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal';
    backdrop.style.display = 'block';
    backdrop.innerHTML = `
        <div class="modal-content" style="max-width: 400px; margin: 20% auto;">
            <div class="modal-header">
                <h2>Confirm Action</h2>
            </div>
            <div class="modal-body">
                <p style="margin: 20px 0; line-height: 1.4;">${message}</p>
                <div class="planet-buttons">
                    <button class="btn btn-secondary" id="confirmCancel">Cancel</button>
                    <button class="btn btn-primary" id="confirmOk">Confirm</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(backdrop);

    const closeDialog = () => {
        document.body.removeChild(backdrop);
    };

    backdrop.querySelector('#confirmCancel').addEventListener('click', () => {
        closeDialog();
        if (onCancel) onCancel();
    });

    backdrop.querySelector('#confirmOk').addEventListener('click', () => {
        closeDialog();
        onConfirm();
    });

    // Close on backdrop click
    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
            closeDialog();
            if (onCancel) onCancel();
        }
    });
}

// Initialize toast manager and make it globally accessible
const toastManager = new ToastManager();
window.toastManager = toastManager;
window.showConfirmDialog = showConfirmDialog;

// Export for module use as well
window.ToastManager = ToastManager;