/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    // Таблица складов
    await knex.schema.createTable('warehouses', table => {
        table.increments('id').primary();
        table.string('warehouse_name').notNullable();
        table.string('geo_name').notNullable();
        // Составной уникальный индекс для предотвращения дубликатов
        table.unique(['warehouse_name', 'geo_name']);
        table.timestamps(true, true);
    });

    // Таблица тарифов
    await knex.schema.createTable('tariffs', table => {
        table.increments('id').primary();
        
        // Внешний ключ на склад
        table.integer('warehouse_id')
            .notNullable()
            .references('id')
            .inTable('warehouses')
            .onDelete('CASCADE');
        
        // Даты
        table.date('day').notNullable();  // День тарифа
        table.datetime('fetched_at').notNullable(); // Время получения данных
        table.string('dt_next_box');    // Дата следующего бокса из API
        table.string('dt_till_max');    // Дата окончания действия из API
        
        // Тарифы доставки
        table.decimal('box_delivery_base', 15, 2).notNullable();
        table.decimal('box_delivery_coef_expr', 15, 2).notNullable();
        table.decimal('box_delivery_liter', 15, 2).notNullable();
        
        // Тарифы доставки маркетплейс
        table.decimal('box_delivery_marketplace_base', 15, 2).notNullable();
        table.decimal('box_delivery_marketplace_coef_expr', 15, 2).notNullable();
        table.decimal('box_delivery_marketplace_liter', 15, 2).notNullable();
        
        // Тарифы хранения
        table.decimal('box_storage_base', 15, 2).notNullable();
        table.decimal('box_storage_coef_expr', 15, 2).notNullable();
        table.decimal('box_storage_liter', 15, 2).notNullable();

        table.timestamps(true, true);

        // Индекс для быстрого поиска по дате
        table.index('day');
        
        // Составной уникальный индекс для UPSERT
        table.unique(['warehouse_id', 'day']);
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.dropTableIfExists('tariffs');
    await knex.schema.dropTableIfExists('warehouses');
}