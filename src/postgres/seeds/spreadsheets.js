/**
 * @param {import("knex").Knex} knex
 * @returns {Promise<void>}
 */
export async function seed(knex) {
    // Получение id таблиц из переменной среды SEED_SPREADSHEET_IDS (через запятую)
    const idsStr = process.env.SEED_SPREADSHEET_IDS;
    const ids = idsStr ? idsStr.split(',').map(id => id.trim()).filter(Boolean) : [];
    if (!ids.length) {
        console.warn('SEED_SPREADSHEET_IDS не задан и сидирование spreadsheets не выполнено.');
        return;
    }

    await knex("spreadsheets").del();
    await knex("spreadsheets")
        .insert(ids.map(spreadsheet_id => ({ spreadsheet_id })))
        .onConflict(["spreadsheet_id"])
        .ignore();
};
