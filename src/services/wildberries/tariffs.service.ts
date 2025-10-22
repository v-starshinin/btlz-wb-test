import { wbLogger } from '../../utils/logger.js';

import axios, { AxiosError, AxiosInstance } from 'axios';
import type {
    WarehouseTariff,
    TariffData,
    BoxTariffResponse,
    ProblemResponse
} from './types.js';
import {
    ApiError,
    UnauthorizedError,
    RateLimitError
} from './errors.js';

export class WildberriesTariffsService {
    static BASE_URL = 'https://common-api.wildberries.ru/api/v1';
    private readonly apiKey: string;
    private readonly client: AxiosInstance;
    private readonly maxRetries: number;
    private readonly backoffBaseMs: number;
    private readonly backoffMaxMs: number;

    constructor() {
        this.apiKey = process.env.WB_API_KEY || '';
        if (!this.apiKey) throw new Error('WB_API_KEY is not set in environment variables');

        this.maxRetries = Number.parseInt(process.env.WB_MAX_RETRIES ?? '3', 10) || 3;
        this.backoffBaseMs = Number.parseInt(process.env.WB_BACKOFF_BASE_MS ?? '1000', 10) || 1000;
        this.backoffMaxMs = Number.parseInt(process.env.WB_BACKOFF_MAX_MS ?? '30000', 10) || 30000;

        this.client = axios.create({
            baseURL: WildberriesTariffsService.BASE_URL,
            timeout: 15_000,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    /**
     * Парсит структуру ошибки, которую возвращает API WB
     */
    private static parseProblem(respData: unknown): ProblemResponse | undefined {
        if (!respData || typeof respData !== 'object') return undefined;
        const p: ProblemResponse = {};
        const src = respData as Record<string, unknown>;
        if (typeof src.title === 'string') p.title = src.title;
        if (typeof src.detail === 'string') p.detail = src.detail;
        if (typeof src.code === 'string') p.code = src.code;
        if (typeof src.requestId === 'string') p.requestId = src.requestId;
        if (typeof src.origin === 'string') p.origin = src.origin;
        if (typeof src.status === 'number') p.status = src.status;
        if (typeof src.timestamp === 'string') p.timestamp = src.timestamp;
        return p;
    }

    /**
     * Универсальный запрос с повторными попытками/бэкофом для лимитов и временных ошибок
     */
    /**
     * Делает запрос к API WB с ретраями и бэкоффом
     */
    private async requestWithRetry<T>(url: string): Promise<T> {
        let lastError: unknown = null;
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                wbLogger.info(`[WB API] Requesting ${url}`);
                const res = await this.client.get<T>(url, {
                    headers: { Authorization: this.apiKey }
                });
                return res.data;
            } catch (err) {
                lastError = err;
                if (!axios.isAxiosError(err)) throw err;
                const axiosErr = err as AxiosError<any>;
                const status = axiosErr.response?.status;
                const problem = WildberriesTariffsService.parseProblem(axiosErr.response?.data);

                if (status === 401)
                    throw new UnauthorizedError(axiosErr.message, problem);

                if (status === 400)
                    throw new ApiError('Bad request', 400, problem);

                if (status === 429) {
                    const ra = axiosErr.response?.headers && (axiosErr.response.headers['retry-after'] || axiosErr.response.headers['Retry-After']);
                    let retryAfterSec: number | undefined;
                    if (ra) {
                        const v = Array.isArray(ra) ? ra[0] : ra;
                        const parsed = Number.parseInt(String(v), 10);
                        if (!Number.isNaN(parsed)) retryAfterSec = parsed;
                    }
                    if (attempt >= this.maxRetries) throw new RateLimitError('Rate limited and retries exhausted', retryAfterSec, problem);
                    const waitMs = retryAfterSec ? retryAfterSec * 1000 : Math.min(this.backoffMaxMs, this.backoffBaseMs * Math.pow(2, attempt));
                    await new Promise(r => setTimeout(r, waitMs));
                    continue;
                }

                if (!status || (status >= 500 && status < 600) || axiosErr.code === 'ECONNABORTED' || axiosErr.code === 'ENOTFOUND') {
                    if (attempt >= this.maxRetries) break;
                    const wait = Math.min(this.backoffMaxMs, this.backoffBaseMs * Math.pow(2, attempt));
                    await new Promise(r => setTimeout(r, wait));
                    continue;
                }
                throw new ApiError(axiosErr.message, status, problem);
            }
        }
        if (lastError) throw lastError;
        throw new Error('Unknown error in requestWithRetry');
    }

    /**
     * Получить тарифы для коробов на определённую дату
     * @param date Необязательная дата в формате YYYY-MM-DD. Если не передано — используется текущая дата
     */
    async getBoxTariffs(date?: string): Promise<BoxTariffResponse> {
        const requestDate = date || new Date().toISOString().split('T')[0];
        const url = `/tariffs/box?date=${encodeURIComponent(requestDate)}`;
        return this.requestWithRetry<BoxTariffResponse>(url);
    }
}

export const wildberriesTariffsService = new WildberriesTariffsService();