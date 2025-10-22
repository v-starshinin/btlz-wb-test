import dotenv from 'dotenv';
import express from 'express';
import cron from 'node-cron';
import knex, { migrate, seed } from '#postgres/knex.js';
import { wildberriesTariffsService } from './services/wildberries/tariffs.service.js';
import { TariffStorageService } from './services/wildberries/tariff-storage.service.js';
import { exportTariffsToSheets } from './services/googleSheets/exporter.js';

dotenv.config();

await migrate.latest();
await seed.run();

console.log('Migrations and seeds applied');

const app = express();
const port = process.env.APP_PORT ?? 5000;

const storage = new TariffStorageService();

async function fetchAndStore() {
    const today = new Date().toISOString().split('T')[0];
    let res = null;
    try {
        res = await wildberriesTariffsService.getBoxTariffs(today);
    } catch (err) {
        console.error('[fetchAndStore] Ошибка получения тарифов из WB API:', err);
        return;
    }

    try {
        await storage.saveTariffs(res, today);
    } catch (err) {
        console.error('[fetchAndStore] Ошибка при сохранении тарифов в БД:', err);
        return;
    }

    try {
        await exportTariffsToSheets();
    } catch (err) {
        console.error('[fetchAndStore] Ошибка экспорта тарифов в Google Sheets:', err);
        return;
    }

    console.log('Tariffs fetched, stored, exported at', new Date().toISOString());
}

// Один раз при запуске
(async () => {
    try {
        await fetchAndStore();
    } catch (err) {
        console.error('[Main] Ошибка при первом запуске fetchAndStore:', err);
    }
})();

// Запускать каждый час (CRON)
try {
    cron.schedule('0 * * * *', async () => {
        try {
            console.log('Cron job started at', new Date().toISOString());
            await fetchAndStore();
        } catch (err) {
            console.error('[CRON] Ошибка в часовом запуске:', err);
        }
    });
} catch (err) {
    console.error('[CRON] Не удалось запустить cron-задачу:', err);
}

app.get('/health', (_req, res) => {
    try {
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ ok: false, error: 'internal error' });
    }
});

app.post('/fetch-now', async (_req, res) => {
    try {
        await fetchAndStore();
        res.json({ ok: true });
    } catch (err) {
        const message = (err instanceof Error) ? err.message : String(err);
        res.status(500).json({ ok: false, error: 'fetch failed', detail: message });
    }
});

app.listen(port, () => {
	console.log(`App listening on port ${port}`);
});

export default app;