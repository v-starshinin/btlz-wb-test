export class ApiError extends Error {
    status: number;
    problem?: string;

    constructor(message: string, status: number = 500, problem?: string) {
        super(message);
        this.name = this.constructor.name;
        this.status = status;
        this.problem = problem;
        Error.captureStackTrace(this, this.constructor);
    }
}

export class UnauthorizedError extends ApiError {
    constructor(message: string = 'Unauthorized', problem?: string) {
        super(message, 401, problem);
    }
}

export class RateLimitError extends ApiError {
    retryAfter?: number;

    constructor(message: string = 'Rate limit exceeded', retryAfter?: number, problem?: string) {
        super(message, 429, problem);
        this.retryAfter = retryAfter;
    }
}

export class ValidationError extends ApiError {
    errors: any[];

    constructor(message: string = 'Validation failed', errors: any[] = [], problem?: string) {
        super(message, 400, problem);
        this.errors = errors;
    }
}

export class NotFoundError extends ApiError {
    constructor(message: string = 'Resource not found', problem?: string) {
        super(message, 404, problem);
    }
}