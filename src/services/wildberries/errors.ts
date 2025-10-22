// Кастомные ошибки для работы с API Wildberries
import type { ProblemResponse } from './types.js';

export class ApiError extends Error {
    status?: number;
    problem?: ProblemResponse;
    constructor(message: string, status?: number, problem?: ProblemResponse) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.problem = problem;
    }
}

export class UnauthorizedError extends ApiError {
    constructor(message = 'Unauthorized', problem?: ProblemResponse) {
        super(message, 401, problem);
        this.name = 'UnauthorizedError';
    }
}

export class RateLimitError extends ApiError {
    retryAfter?: number;
    constructor(message = 'Rate limited', retryAfter?: number, problem?: ProblemResponse) {
        super(message, 429, problem);
        this.name = 'RateLimitError';
        this.retryAfter = retryAfter;
    }
}
