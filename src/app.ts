import dotenv from 'dotenv';
import express from 'express';
import cron from 'node-cron';
import knex, { migrate, seed } from '#postgres/knex.js';
import { wildberriesTariffsService } from './services/wildberries/tariffs.service.js';
import { logger, apiLogger } from './utils/logger.js';
import { TariffStorageService } from './services/wildberries/tariff-storage.service.js';
import { GoogleSheetsExporter } from './services/googleSheets/exporter.js';

dotenv.config();

await migrate.latest();
await seed.run();

logger.info('Migrations and seeds applied');

const app = express();
const port = process.env.APP_PORT ?? 5000;

const storage = new TariffStorageService();


const googleSheetsExporter = new GoogleSheetsExporter();
async function fetchAndStore() {
    const today = new Date().toISOString().split('T')[0];
    let res = null;
    try {
        res = await wildberriesTariffsService.getBoxTariffs(today);

    } catch (err) {
        apiLogger.error('[fetchAndStore] Ошибка получения тарифов из WB API:', err);
        return;
    }

    try {
        await storage.saveTariffs(res, today);

    } catch (err) {
        apiLogger.error('[fetchAndStore] Ошибка при сохранении тарифов в БД:', err);
        return;
    }

    try {
        await googleSheetsExporter.exportTariffsToSheets();

    } catch (err) {
        apiLogger.error('[fetchAndStore] Ошибка экспорта тарифов в Google Sheets:', err);
        return;
    }

    apiLogger.info('Tariffs fetched, stored, exported at', new Date().toISOString());
}

// Один раз при запуске
(async () => {
    try {
        await fetchAndStore();
    } catch (err) {
    logger.error('[Main] Ошибка при первом запуске fetchAndStore:', err);
    }
})();

// Запускать каждый час (CRON)
try {
    cron.schedule('0 * * * *', async () => {
        try {
            logger.debug('Cron job started at', new Date().toISOString());
            await fetchAndStore();
        } catch (err) {
            logger.error('[CRON] Ошибка в часовом запуске:', err);
        }
    });
} catch (err) {
    logger.error('[CRON] Не удалось запустить cron-задачу:', err);
}


// Health-check: проверяет соединение с БД и Google Sheets API
app.get('/health', async (_req, res) => {
    try {
        // Проверка БД
        let dbOk = false;
        try {
            await knex.raw('select 1+1 as result');
            dbOk = true;
        } catch (dbErr) {
            dbOk = false;
        }


        // Проверка Google Sheets API с использованием ключа
        let sheetsOk = false;
        let sheetsKeyError: string | null = null;
        try {
            const authResult = await googleSheetsExporter.testAuth();
            sheetsOk = authResult.ok;
            sheetsKeyError = authResult.error || null;
        } catch (sheetsErr: any) {
            sheetsOk = false;
            sheetsKeyError = sheetsErr instanceof Error ? sheetsErr.message : String(sheetsErr);
        }

        res.json({
            ok: dbOk && sheetsOk,
            db: dbOk,
            googleSheets: sheetsOk,
            googleSheetsKeyError: sheetsKeyError
        });
    } catch (err) {
    apiLogger.error('[health-check] Ошибка:', err);
    res.status(500).json({ ok: false, error: 'internal error', detail: (err instanceof Error ? err.message : String(err)) });
    }
});

app.get('/fetch-now', async (_req, res) => {
    try {
        await fetchAndStore();
        res.json({ ok: true });
    } catch (err) {
        const message = (err instanceof Error) ? err.message : String(err);
    apiLogger.error('[fetch-now] Ошибка:', err);
    res.status(500).json({ ok: false, error: 'fetch failed', detail: message });
    }
});

app.listen(port, () => {
    logger.info(`App listening on port ${port}`);
});

export default app;