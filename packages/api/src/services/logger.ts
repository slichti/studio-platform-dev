import { captureException } from "@sentry/cloudflare";

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogContext {
    traceId?: string;
    tenantId?: string;
    userId?: string;
    environment?: string;
    [key: string]: any;
}

export class LoggerService {
    constructor(private context: LogContext = {}) { }

    private log(level: LogLevel, message: string, data?: any) {
        const payload = {
            timestamp: new Date().toISOString(),
            level,
            message,
            ...this.context,
            ...data
        };

        const strPayload = JSON.stringify(payload);

        if (level === 'error') {
            console.error(strPayload);
            // Sentry Integration
            if (data?.error instanceof Error) {
                captureException(data.error);
            } else {
                captureException(new Error(message));
            }
        } else if (level === 'warn') {
            console.warn(strPayload);
        } else if (level === 'debug') {
            if (this.context.environment === 'dev' || this.context.environment === 'development') {
                console.debug(strPayload);
            }
        } else {
            console.log(strPayload);
        }
    }

    info(message: string, data?: any) { this.log('info', message, data); }
    warn(message: string, data?: any) { this.log('warn', message, data); }
    error(message: string, data?: any) { this.log('error', message, data); }
    debug(message: string, data?: any) { this.log('debug', message, data); }

    /**
     * Creates a new logger instance with merged context
     */
    withContext(newContext: Partial<LogContext>): LoggerService {
        return new LoggerService({ ...this.context, ...newContext });
    }

    /**
     * Static helper for basic logging before context is available
     */
    static staticLog(level: LogLevel, message: string, data?: any) {
        new LoggerService().log(level, message, data);
    }
}
