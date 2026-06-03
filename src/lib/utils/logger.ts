/**
 * Centralized Logger Utility
 *
 * Provides consistent logging across the application with:
 * - Log levels (debug, info, warn, error)
 * - Production mode filtering (debug disabled in prod)
 * - Emoji prefixes for visual scanning
 * - Optional module/component context
 *
 * Usage:
 *   import { logger } from '$lib/utils/logger';
 *   logger.debug('MyComponent', 'Processing data', { count: 42 });
 *   logger.info('Audio initialized');
 *   logger.warn('Fallback used', { reason: 'timeout' });
 *   logger.error('Failed to load', error);
 */

import { browser } from '$app/environment';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
	/** Enable debug logs (default: true in dev, false in prod) */
	enableDebug: boolean;
	/** Enable info logs (default: true) */
	enableInfo: boolean;
	/** Prefix all logs with timestamp */
	showTimestamp: boolean;
	/** Show module/component context */
	showContext: boolean;
}

const defaultConfig: LoggerConfig = {
	enableDebug: import.meta.env.DEV,
	enableInfo: true,
	showTimestamp: false,
	showContext: true
};

let config = { ...defaultConfig };

const LEVEL_EMOJI: Record<LogLevel, string> = {
	debug: '🔍',
	info: 'ℹ️',
	warn: '⚠️',
	error: '❌'
};

const LEVEL_COLORS: Record<LogLevel, string> = {
	debug: 'color: #888',
	info: 'color: #4a9eff',
	warn: 'color: #f59e0b',
	error: 'color: #ef4444'
};

function formatMessage(level: LogLevel, context: string | undefined, message: string): string {
	const parts: string[] = [];

	if (config.showTimestamp) {
		parts.push(`[${new Date().toISOString().slice(11, 23)}]`);
	}

	parts.push(LEVEL_EMOJI[level]);

	if (config.showContext && context) {
		parts.push(`[${context}]`);
	}

	parts.push(message);

	return parts.join(' ');
}

function log(
	level: LogLevel,
	context: string | undefined,
	message: string,
	...args: unknown[]
): void {
	if (!browser) return; // No logging during SSR

	// Check if level is enabled
	if (level === 'debug' && !config.enableDebug) return;
	if (level === 'info' && !config.enableInfo) return;

	const formattedMessage = formatMessage(level, context, message);

	switch (level) {
		case 'debug':
			console.log(`%c${formattedMessage}`, LEVEL_COLORS.debug, ...args);
			break;
		case 'info':
			console.log(`%c${formattedMessage}`, LEVEL_COLORS.info, ...args);
			break;
		case 'warn':
			console.warn(formattedMessage, ...args);
			break;
		case 'error':
			console.error(formattedMessage, ...args);
			break;
	}
}

/**
 * Main logger object with methods for each log level
 */
export const logger = {
	/**
	 * Debug level - only shown in development
	 * @param contextOrMessage - Module/component name OR message if no context
	 * @param messageOrArgs - Message OR additional args if no context
	 * @param args - Additional data to log
	 */
	debug(contextOrMessage: string, messageOrArgs?: string | unknown, ...args: unknown[]): void {
		if (typeof messageOrArgs === 'string') {
			log('debug', contextOrMessage, messageOrArgs, ...args);
		} else {
			log('debug', undefined, contextOrMessage, messageOrArgs, ...args);
		}
	},

	/**
	 * Info level - general information
	 */
	info(contextOrMessage: string, messageOrArgs?: string | unknown, ...args: unknown[]): void {
		if (typeof messageOrArgs === 'string') {
			log('info', contextOrMessage, messageOrArgs, ...args);
		} else {
			log('info', undefined, contextOrMessage, messageOrArgs, ...args);
		}
	},

	/**
	 * Warning level - potential issues
	 */
	warn(contextOrMessage: string, messageOrArgs?: string | unknown, ...args: unknown[]): void {
		if (typeof messageOrArgs === 'string') {
			log('warn', contextOrMessage, messageOrArgs, ...args);
		} else {
			log('warn', undefined, contextOrMessage, messageOrArgs, ...args);
		}
	},

	/**
	 * Error level - always shown
	 */
	error(contextOrMessage: string, messageOrArgs?: string | unknown, ...args: unknown[]): void {
		if (typeof messageOrArgs === 'string') {
			log('error', contextOrMessage, messageOrArgs, ...args);
		} else {
			log('error', undefined, contextOrMessage, messageOrArgs, ...args);
		}
	},

	/**
	 * Configure logger settings
	 */
	configure(newConfig: Partial<LoggerConfig>): void {
		config = { ...config, ...newConfig };
	},

	/**
	 * Reset to default configuration
	 */
	reset(): void {
		config = { ...defaultConfig };
	},

	/**
	 * Disable all debug logging (useful for production)
	 */
	disableDebug(): void {
		config.enableDebug = false;
	},

	/**
	 * Enable debug logging
	 */
	enableDebug(): void {
		config.enableDebug = true;
	}
};

// Module-specific logger factory
export function createLogger(moduleName: string) {
	return {
		debug: (message: string, ...args: unknown[]) => logger.debug(moduleName, message, ...args),
		info: (message: string, ...args: unknown[]) => logger.info(moduleName, message, ...args),
		warn: (message: string, ...args: unknown[]) => logger.warn(moduleName, message, ...args),
		error: (message: string, ...args: unknown[]) => logger.error(moduleName, message, ...args)
	};
}

export default logger;
