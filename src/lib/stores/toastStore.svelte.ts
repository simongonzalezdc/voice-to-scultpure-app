/**
 * Toast Notification Store
 * PHASE 3: Radical Observability - "Blindness Check" for File Operations
 *
 * Centralized toast notification system for user feedback.
 * Used for Save, Export, and other async operations that need user confirmation.
 *
 * ARCHITECTURAL PRINCIPLE:
 * - Every file operation (Save, Export) must provide immediate visual feedback
 * - Toasts auto-dismiss after 4-5 seconds, or user can close manually
 * - Multiple toasts can stack (useful for batch operations)
 * - Toast history is kept for debugging (max 100 recent toasts)
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
	id: string;
	type: ToastType;
	title: string;
	message: string;
	duration: number; // ms
	dismissable: boolean;
	createdAt: number;
}

export interface ToastStoreState {
	toasts: Toast[];
	history: Toast[];
	maxHistorySize: number;
}

class ToastStore {
	private toasts = $state<Toast[]>([]);
	private history = $state<Toast[]>([]);
	private readonly maxHistorySize = 100;
	private autoDismissTimers = new Map<string, number>();

	/**
	 * Shows a success toast
	 * @param title - Main title
	 * @param message - Detailed message
	 * @param duration - Auto-dismiss time (default 4000ms)
	 */
	success(title: string, message: string, duration: number = 4000) {
		this.add('success', title, message, duration, true);
	}

	/**
	 * Shows an error toast
	 * @param title - Main title
	 * @param message - Detailed message (often error.message)
	 * @param duration - Auto-dismiss time (default 6000ms for errors)
	 */
	error(title: string, message: string, duration: number = 6000) {
		this.add('error', title, message, duration, true);
	}

	/**
	 * Shows a warning toast
	 * @param title - Main title
	 * @param message - Detailed message
	 * @param duration - Auto-dismiss time (default 5000ms)
	 */
	warning(title: string, message: string, duration: number = 5000) {
		this.add('warning', title, message, duration, true);
	}

	/**
	 * Shows an info toast
	 * @param title - Main title
	 * @param message - Detailed message
	 * @param duration - Auto-dismiss time (default 3000ms)
	 */
	info(title: string, message: string, duration: number = 3000) {
		this.add('info', title, message, duration, true);
	}

	/**
	 * Internal: Adds a toast to the store
	 */
	private add(
		type: ToastType,
		title: string,
		message: string,
		duration: number,
		dismissable: boolean
	) {
		const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		const toast: Toast = {
			id,
			type,
			title,
			message,
			duration,
			dismissable,
			createdAt: Date.now()
		};

		this.toasts.push(toast);
		this.history.push(toast);

		// Keep history size bounded
		if (this.history.length > this.maxHistorySize) {
			this.history.shift();
		}

		// Auto-dismiss after duration
		if (duration > 0) {
			const timer = setTimeout(() => {
				this.dismiss(id);
			}, duration) as unknown as number;
			this.autoDismissTimers.set(id, timer);
		}
	}

	/**
	 * Manually dismiss a toast
	 */
	dismiss(id: string) {
		const index = this.toasts.findIndex((t) => t.id === id);
		if (index !== -1) {
			this.toasts.splice(index, 1);
		}

		// Clear auto-dismiss timer if exists
		const timer = this.autoDismissTimers.get(id);
		if (timer !== undefined) {
			clearTimeout(timer);
			this.autoDismissTimers.delete(id);
		}
	}

	/**
	 * Dismiss all toasts
	 */
	dismissAll() {
		this.toasts = [];
		this.autoDismissTimers.forEach((timer) => clearTimeout(timer));
		this.autoDismissTimers.clear();
	}

	/**
	 * Get all active toasts
	 */
	getToasts(): Toast[] {
		return this.toasts;
	}

	/**
	 * Get toast history (for debugging)
	 */
	getHistory(): Toast[] {
		return this.history;
	}

	/**
	 * Clear history
	 */
	clearHistory() {
		this.history = [];
	}
}

// Create singleton instance
export const toastStore = new ToastStore();
