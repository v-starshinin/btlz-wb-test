/**
 * @param {import("knex").Knex} knex
 * @returns {Promise<void>}
 */
export async function seed(knex) {
    await knex("spreadsheets")
        .insert([{ spreadsheet_id: "13VFrXW_wUg0-Thlvjxn8saCUhFE4SDi5hQsdeY2SZIc" }])
        .onConflict(["spreadsheet_id"])
        .ignore();
}
