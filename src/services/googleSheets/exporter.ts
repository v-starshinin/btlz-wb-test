import { googleLogger } from '../../utils/logger.js';

import { google } from 'googleapis';
import { SpreadsheetsRepository } from '../../repositories/spreadsheets.repository.js';
import { TariffsRepository } from '../../repositories/tariffs.repository.js';
import type { sheets_v4 } from 'googleapis';
import type { SpreadsheetDbRow, TariffRow } from './types.js';

export class GoogleSheetsExporter {
    private sheetsClient: sheets_v4.Sheets;

    constructor() {
        this.sheetsClient = this.createSheetsClient();
    }

    private createSheetsClient(): sheets_v4.Sheets {
        const credentialsBase64 = process.env.GOOGLE_SA_CREDENTIALS;
        const credentialsPath = process.env.GOOGLE_SA_PATH;
        let authClient;
        if (credentialsBase64) {
            const json = JSON.parse(Buffer.from(credentialsBase64, 'base64').toString('utf8'));
            authClient = new google.auth.GoogleAuth({
                credentials: json,
                scopes: ['https://www.googleapis.com/auth/spreadsheets']
            });
        } else if (credentialsPath) {
            authClient = new google.auth.GoogleAuth({
                keyFile: credentialsPath,
                scopes: ['https://www.googleapis.com/auth/spreadsheets']
            });
        } else {
            throw new Error('Google service account credentials not provided in env');
        }
        return google.sheets({ version: 'v4', auth: authClient });
    }

    /**
     * Проверяет работоспособность (доступность токена/ключа) Google Sheets API — AUTH и базовые права.
     * Сделает запрос spreadsheets.get по несуществующему ID и проверит, что ошибка — авторизационная или 404.
     * Возвращает true, если API доступен и ключ правильный.
     */
    async testAuth(): Promise<{ ok: boolean; error?: string }> {
        try {
            await this.sheetsClient.spreadsheets.get({ spreadsheetId: 'fake_ping_id_for_auth' });
            // если вдруг такого ID нет, тем не менее API работает
            return { ok: true };
        } catch (e: any) {
            // code 404, 400, 403, 401 (AUTH/perm или Not Found) — нормально
            if (e && typeof e === 'object' && (
                e.code === 404 || e.code === 400 || e.code === 403 || e.code === 401
            )) {
                return { ok: true };
            }
            return { ok: false, error: e && typeof e === 'object' ? e.message : String(e) };
        }
    }

    getClient(): sheets_v4.Sheets {
        return this.sheetsClient;
    }

    /**
     * Экспортирует тарифы в N Google Sheets
     */
    async exportTariffsToSheets(): Promise<void> {
        const spreadsheets: SpreadsheetDbRow[] = await SpreadsheetsRepository.getAll();
        if (!spreadsheets.length) {
            googleLogger.warn('No spreadsheets found in DB');
            return;
        }
        const sheetIds: string[] = spreadsheets.map(s => s.spreadsheet_id);

        const today = new Date().toISOString().split('T')[0];
        const rows: TariffRow[] = await TariffsRepository.getLatestTariffs(today);
        if (!rows.length) {
            googleLogger.warn('No tariff data for export');
            return;
        }

        const header = [
            'Дата', 'Время выгрузки', 'Следующий бокс', 'Действует до',
            'Название склада', 'Местоположение',
            'Базовая стоимость доставки', 'Коэф. доставки', 'За литр доставки',
            'Базовая доставка маркетплейс', 'Коэф. доставки маркетплейс', 'За литр доставки маркетплейс',
            'Базовая стоимость хранения', 'Коэф. хранения', 'За литр хранения'
        ];

        function norm(v: unknown): number | '' {
            // Преобразует строку в число, если это возможно
            if (v === null || v === undefined || v === '' || v === 'NaN') return '';
            const num = Number(v);
            // Если это NaN или строковое "NaN" — вернуть ''
            return (typeof num === 'number' && !isNaN(num)) ? num : '';
        }

        const values: (string | number)[][] = [
            header,
            ...rows.map(row => [
                row.day,
                new Date(row.fetched_at).toLocaleString('ru-RU', { hour12: false }),
                row.dt_next_box,
                row.dt_till_max,
                row.warehouse_name,
                row.geo_name,
                norm(row.box_delivery_base),
                norm(row.box_delivery_coef_expr),
                norm(row.box_delivery_liter),
                norm(row.box_delivery_marketplace_base),
                norm(row.box_delivery_marketplace_coef_expr),
                norm(row.box_delivery_marketplace_liter),
                norm(row.box_storage_base),
                norm(row.box_storage_coef_expr),
                norm(row.box_storage_liter)
            ])
        ];

        for (const spreadsheetId of sheetIds) {
            // Найдём таб по имени stocks_coefs, создадим если нужно
            let sheetTitle = 'stocks_coefs';
            let foundSheetId: number | undefined = undefined;
            try {
                const info = await this.sheetsClient.spreadsheets.get({ spreadsheetId });
                const target = info.data.sheets?.find(
                    s => s.properties?.title === sheetTitle
                );
                const candidateId = target?.properties?.sheetId;
                foundSheetId = (typeof candidateId === 'number') ? candidateId : undefined;
            } catch (e) {
                googleLogger.error(`Ошибка при получении листов Google Sheets: ${e}`);
            }
            // Если листа нет — создаём
            if (!foundSheetId) {
                try {
                    const createRes = await this.sheetsClient.spreadsheets.batchUpdate({
                        spreadsheetId,
                        requestBody: {
                            requests: [{
                                addSheet: {
                                    properties: { title: sheetTitle }
                                }
                            }]
                        }
                    });
                    const createdId = createRes.data.replies?.[0]?.addSheet?.properties?.sheetId;
                    foundSheetId = (typeof createdId === 'number') ? createdId : undefined;
                    googleLogger.info(`Создан лист stocks_coefs в таблице ${spreadsheetId}`);
                } catch (e: any) {
                    // Если ошибка - такой лист уже есть (already exists) — просто ищём id листа и продолжаем экспорт
                    const errMsg = e?.message || String(e);
                    if (errMsg.includes('already exists')) {
                        googleLogger.warn(`Лист stocks_coefs уже существует в ${spreadsheetId}, ищу повторно...`);
                        try {
                            const info = await this.sheetsClient.spreadsheets.get({ spreadsheetId });
                            const target = info.data.sheets?.find(
                                s => s.properties?.title === sheetTitle
                            );
                            const candidateId = target?.properties?.sheetId;
                            foundSheetId = (typeof candidateId === 'number') ? candidateId : undefined;
                        } catch (findErr) {
                            googleLogger.error(`Не удалось найти id листа после already exists: ${findErr}`);
                            continue;
                        }
                    } else {
                        googleLogger.error(`Не удалось создать лист stocks_coefs: ${e}`);
                        continue;
                    }
                }
            }
            // Экспортируем в найденный лист
            try {
                await this.sheetsClient.spreadsheets.values.update({
                    spreadsheetId,
                    range: `${sheetTitle}!A1`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values }
                });
                googleLogger.info(`Updated spreadsheet ${spreadsheetId} (лист stocks_coefs)`);
            } catch (e) {
                googleLogger.error(`Ошибка записи в лист stocks_coefs для ${spreadsheetId}: ${e}`);
            }
        }
    }
}

