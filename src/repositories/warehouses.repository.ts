import knex from '#postgres/knex.js';
import type { Warehouse } from '../services/wildberries/tariff-storage.types.js';
import { dbLogger } from '../utils/logger.js';

export const WarehousesRepository = {
  async findOrCreate(warehouseName: string, geoName: string): Promise<Warehouse> {
    dbLogger.debug(`Поиск склада ${warehouseName}, ${geoName}`);
    const existing = await knex<Warehouse>('warehouses')
      .where({ warehouse_name: warehouseName, geo_name: geoName })
      .first();
    if (existing) return existing;

    const [created] = await knex<Warehouse>('warehouses')
      .insert({ warehouse_name: warehouseName, geo_name: geoName })
      .returning('*');
    dbLogger.info(`Создан новый склад: ${warehouseName}, ${geoName}`);
    return created;
  }

};
