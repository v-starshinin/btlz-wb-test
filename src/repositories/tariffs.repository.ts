import knex from '#postgres/knex.js';
import type { TariffRecord } from '../services/wildberries/tariff-storage.types.js';
import { dbLogger } from '../utils/logger.js';

export const TariffsRepository = {
  async upsertTariff(record: TariffRecord): Promise<void> {
    dbLogger.info(`Upsert тарифа для склада id=${record.warehouse_id}, день=${record.day}`);
    await knex('tariffs').insert(record)
      .onConflict(['warehouse_id', 'day'])
      .merge({
        fetched_at: record.fetched_at,
        dt_next_box: record.dt_next_box,
        dt_till_max: record.dt_till_max,
        box_delivery_base: record.box_delivery_base,
        box_delivery_coef_expr: record.box_delivery_coef_expr,
        box_delivery_liter: record.box_delivery_liter,
        box_delivery_marketplace_base: record.box_delivery_marketplace_base,
        box_delivery_marketplace_coef_expr: record.box_delivery_marketplace_coef_expr,
        box_delivery_marketplace_liter: record.box_delivery_marketplace_liter,
        box_storage_base: record.box_storage_base,
        box_storage_coef_expr: record.box_storage_coef_expr,
        box_storage_liter: record.box_storage_liter,
        updated_at: record.fetched_at
      });
  },

  async getLatestTariffs(date: string): Promise<any[]> {
    dbLogger.debug(`Получение тарифов за дату: ${date}`);
    return knex('tariffs')
      .select('warehouses.warehouse_name', 'warehouses.geo_name', 'tariffs.*')
      .leftJoin('warehouses', 'tariffs.warehouse_id', 'warehouses.id')
      .where('tariffs.day', date)
      .orderBy('tariffs.fetched_at', 'desc')
      .orderBy('tariffs.box_storage_coef_expr', 'asc');
  }
};
