import { google } from 'googleapis';
import knex from '#postgres/knex.js';

function getSheetsClient() {
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

export async function exportTariffsToSheets() {
    // Список spreadsheet_id из БД
    const spreadsheets = await knex('spreadsheets').select('spreadsheet_id');
    if (!spreadsheets.length) {
        console.log('No spreadsheets found in DB');
        return;
    }
    const sheetIds = spreadsheets.map(s => s.spreadsheet_id);

    // Сегодняшняя дата
    const today = new Date().toISOString().split('T')[0];

    // Последние тарифы за сегодня по каждому складу
    const rows = await knex('tariffs as t')
        .leftJoin('warehouses as w', 't.warehouse_id', 'w.id')
        .select(
            'w.warehouse_name',
            'w.geo_name',
            't.*'
        )
        .where('t.day', today)
        .orderBy('t.box_storage_coef_expr', 'asc');

    if (!rows.length) {
        console.log('No tariff data for export');
        return;
    }

    const header = [
        'Дата', 'Время выгрузки', 'Следующий бокс', 'Действует до',
        'Название склада', 'Местоположение',
        'Базовая стоимость доставки', 'Коэф. доставки', 'За литр доставки',
        'Базовая доставка маркетплейс', 'Коэф. доставки маркетплейс', 'За литр доставки маркетплейс',
        'Базовая стоимость хранения', 'Коэф. хранения', 'За литр хранения'
    ];


    function norm(v: any) {
        // Преобразуем строку в число, если это возможно
        if (v === null || v === undefined || v === '' || v === 'NaN') return '';
        const num = Number(v);
        // Если это NaN или строковое "NaN" — вернуть ''
        return (typeof num === 'number' && !isNaN(num)) ? num : '';
    }

    const values = [
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

    const sheetsClient = getSheetsClient();
    for (const spreadsheetId of sheetIds) {
        await sheetsClient.spreadsheets.values.update({
            spreadsheetId,
            range: 'stocks_coefs!A1',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values }
        });
        console.log(`Updated spreadsheet ${spreadsheetId}`);
    }
}