
export class AppError extends Error {
    constructor(
        public message: string,
        public statusCode: number = 500,
        public code: string = 'INTERNAL_ERROR',
        public details?: any
    ) {
        super(message);
        this.name = 'AppError';
    }

    toJSON() {
        return {
            error: this.message,
            code: this.code,
            details: this.details
        };
    }
}

export class NotFoundError extends AppError {
    constructor(message: string = 'Resource not found', details?: any) {
        super(message, 404, 'NOT_FOUND', details);
    }
}

export class UnauthorizedError extends AppError {
    constructor(message: string = 'Unauthorized access', details?: any) {
        super(message, 403, 'UNAUTHORIZED', details);
    }
}

export class BadRequestError extends AppError {
    constructor(message: string = 'Bad request', details?: any) {
        super(message, 400, 'BAD_REQUEST', details);
    }
}

export class ValidationError extends AppError {
    constructor(message: string = 'Validation failed', details?: any) {
        super(message, 400, 'VALIDATION_FAILED', details);
    }
}
