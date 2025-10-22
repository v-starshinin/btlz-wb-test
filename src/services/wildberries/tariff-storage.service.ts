import { dbLogger } from '../../utils/logger.js';
import knex from '#postgres/knex.js';
import type { Warehouse, TariffRecord } from './tariff-storage.types.js';

export class TariffStorageService {
    /**
     * Находит или создает запись о складе
     */
    private async findOrCreateWarehouse(warehouseName: string, geoName: string): Promise<Warehouse> {
        const existing = await knex('warehouses')
            .where({ warehouse_name: warehouseName, geo_name: geoName })
            .first();
        if (existing) {
            dbLogger.debug(`Склад найден: ${warehouseName}, ${geoName}`);
            return existing;
        }

        const [created] = await knex('warehouses')
            .insert({
                warehouse_name: warehouseName,
                geo_name: geoName
            })
            .returning('*');
        dbLogger.info(`Создан новый склад: ${warehouseName}, ${geoName}`);
        return created;
    }

    /**
     * Преобразует строковое значение с запятой в число
     */
    private parseNumber(value: string): number {
        return Number(value.toString().replace(',', '.'));
    }

    /**
     * Сохраняет тарифы, полученные из API, в БД
     */
    async saveTariffs(data: any, requestDate: string): Promise<void> {
        const { dtNextBox, dtTillMax, warehouseList } = data.response.data;
        const now = new Date();

        for (const warehouseData of warehouseList) {
            // Находим или создаём склад
            const warehouse = await this.findOrCreateWarehouse(
                warehouseData.warehouseName,
                warehouseData.geoName
            );

            // Формируем запись тарифа
            const record: TariffRecord = {
                warehouse_id: warehouse.id,
                day: requestDate,
                fetched_at: now,
                dt_next_box: dtNextBox,
                dt_till_max: dtTillMax,

                // Переводим из строки в числа
                box_delivery_base: this.parseNumber(warehouseData.boxDeliveryBase),
                box_delivery_coef_expr: this.parseNumber(warehouseData.boxDeliveryCoefExpr),
                box_delivery_liter: this.parseNumber(warehouseData.boxDeliveryLiter),

                box_delivery_marketplace_base: this.parseNumber(warehouseData.boxDeliveryMarketplaceBase),
                box_delivery_marketplace_coef_expr: this.parseNumber(warehouseData.boxDeliveryMarketplaceCoefExpr),
                box_delivery_marketplace_liter: this.parseNumber(warehouseData.boxDeliveryMarketplaceLiter),

                box_storage_base: this.parseNumber(warehouseData.boxStorageBase),
                box_storage_coef_expr: this.parseNumber(warehouseData.boxStorageCoefExpr),
                box_storage_liter: this.parseNumber(warehouseData.boxStorageLiter)
            };

            // Upsert (обновляем если уже есть тариф за этот склад и день, иначе вставляем)
            await knex('tariffs').insert(record)
                .onConflict(['warehouse_id', 'day'])
                .merge({
                    // Обновляем все тарифные поля, даты и время
                    fetched_at: now,
                    dt_next_box: dtNextBox,
                    dt_till_max: dtTillMax,
                    box_delivery_base: record.box_delivery_base,
                    box_delivery_coef_expr: record.box_delivery_coef_expr,
                    box_delivery_liter: record.box_delivery_liter,
                    box_delivery_marketplace_base: record.box_delivery_marketplace_base,
                    box_delivery_marketplace_coef_expr: record.box_delivery_marketplace_coef_expr,
                    box_delivery_marketplace_liter: record.box_delivery_marketplace_liter,
                    box_storage_base: record.box_storage_base,
                    box_storage_coef_expr: record.box_storage_coef_expr,
                    box_storage_liter: record.box_storage_liter,
                    updated_at: now
                });
            dbLogger.info(`Tariff upsert для склада id=${warehouse.id}, день=${requestDate}`);
        }
    }

    /**
     * Получает последние тарифы по дню
     */
    async getLatestTariffs(date: string): Promise<any[]> {
        return knex('tariffs')
            .select('warehouses.warehouse_name', 'warehouses.geo_name', 'tariffs.*')
            .leftJoin('warehouses', 'tariffs.warehouse_id', 'warehouses.id')
            .where('tariffs.day', date)
            .orderBy('tariffs.fetched_at', 'desc')
            .orderBy('tariffs.box_storage_coef_expr', 'asc');
    }
}