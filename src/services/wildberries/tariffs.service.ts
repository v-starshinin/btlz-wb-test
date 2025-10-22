
import axios, { AxiosError, AxiosInstance } from 'axios';
import {
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
    private readonly baseUrl = 'https://common-api.wildberries.ru/api/v1';
    private readonly apiKey: string;
    private readonly client: AxiosInstance;
    private readonly maxRetries: number;
    private readonly backoffBaseMs: number;
    private readonly backoffMaxMs: number;

    constructor() {
        this.apiKey = process.env.WB_API_KEY || '';
        if (!this.apiKey) {
            throw new Error('WB_API_KEY is not set in environment variables');
        }

        this.client = axios.create({
            baseURL: this.baseUrl,
            timeout: 15_000,
            headers: {
                'Content-Type': 'application/json',
                // leave Authorization header per-request to allow changes
            },
        });

        const mr = parseInt(process.env.WB_MAX_RETRIES ?? '3', 10);
        this.maxRetries = Number.isNaN(mr) ? 3 : mr;
        const bb = parseInt(process.env.WB_BACKOFF_BASE_MS ?? '1000', 10);
        this.backoffBaseMs = Number.isNaN(bb) ? 1000 : bb;
        const bm = parseInt(process.env.WB_BACKOFF_MAX_MS ?? '30000', 10);
        this.backoffMaxMs = Number.isNaN(bm) ? 30000 : bm;
    }

    private parseProblem(respData: any): ProblemResponse | undefined {
        if (!respData) return undefined;
        const p: ProblemResponse = {};
        if (typeof respData.title === 'string') p.title = respData.title;
        if (typeof respData.detail === 'string') p.detail = respData.detail;
        if (typeof respData.code === 'string') p.code = respData.code;
        if (typeof respData.requestId === 'string') p.requestId = respData.requestId;
        if (typeof respData.origin === 'string') p.origin = respData.origin;
        if (typeof respData.status === 'number') p.status = respData.status;
        if (typeof respData.timestamp === 'string') p.timestamp = respData.timestamp;
        return p;
    }

    /**
     * Универсальный запрос с повторными попытками/бэкофом для лимитов и временных ошибок
     */
    private async requestWithRetry<T>(url: string): Promise<T> {
        let attempt = 0;
        let lastError: any;

        while (attempt <= this.maxRetries) {
            try {
                console.info(`[WB API] Requesting ${url}`);
                const res = await this.client.get<T>(url, {
                    headers: { Authorization: this.apiKey }
                });
                return res.data;
            } catch (err) {
                attempt += 1;
                lastError = err;

                if (!axios.isAxiosError(err)) {
                    // Не ошибка axios — пробрасываем дальше
                    throw err;
                }

                const axiosErr = err as AxiosError<any>;
                const status = axiosErr.response?.status;
                const problem = this.parseProblem(axiosErr.response?.data);

                // 401: неавторизованный, без повторных попыток
                if (status === 401) {
                    throw new UnauthorizedError(axiosErr.message, problem);
                }

                // 400: некорректный запрос — сразу ошибка
                if (status === 400) {
                    throw new ApiError('Bad request', 400, problem);
                }

                // 429: превышен лимит — учитывать Retry-After если присутствует
                if (status === 429) {
                    const ra = axiosErr.response?.headers && (axiosErr.response.headers['retry-after'] || axiosErr.response.headers['Retry-After']);
                    let retryAfterSec: number | undefined;
                    if (ra) {
                        const v = Array.isArray(ra) ? ra[0] : ra;
                        const parsed = parseInt(String(v), 10);
                        if (!Number.isNaN(parsed)) retryAfterSec = parsed;
                    }

                    if (attempt > this.maxRetries) {
                        throw new RateLimitError('Rate limited and retries exhausted', retryAfterSec, problem);
                    }

                    // Если сервер прислал Retry-After, ждём, иначе экспоненциальный бэкофф
                    const waitMs = retryAfterSec ? retryAfterSec * 1000 : Math.min(this.backoffMaxMs, this.backoffBaseMs * Math.pow(2, attempt));
                    await new Promise(r => setTimeout(r, waitMs));
                    continue; // retry
                }

                // Для 5xx и сетевых ошибок — повторять с экспоненциальной задержкой
                if (!status || (status >= 500 && status < 600) || axiosErr.code === 'ECONNABORTED' || axiosErr.code === 'ENOTFOUND') {
                    if (attempt > this.maxRetries) break;
                    const wait = Math.min(this.backoffMaxMs, this.backoffBaseMs * Math.pow(2, attempt));
                    await new Promise(r => setTimeout(r, wait));
                    continue;
                }

                // Прочие ошибки — бросить общую ошибку ApiError
                throw new ApiError(axiosErr.message, status, problem);
            }
        }

    // Если вышли из цикла — бросить последнюю ошибку
        if (lastError) throw lastError;
        throw new Error('Unknown error in requestWithRetry');
    }

    /**
     * Получить тарифы для коробов на определённую дату
     * @param date Необязательная дата в формате YYYY-MM-DD. Если не передано — используется текущая дата
     */
    async getBoxTariffs(date?: string): Promise<BoxTariffResponse> {
        const params = new URLSearchParams();
        const requestDate = date || new Date().toISOString().split('T')[0];
        params.append('date', requestDate);
        const query = params.toString();
        const url = `/tariffs/box${query ? `?${query}` : ''}`;
        const data = await this.requestWithRetry<BoxTariffResponse>(url);
        return data;
    }
}

export const wildberriesTariffsService = new WildberriesTariffsService();