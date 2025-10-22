import type { Warehouse, TariffRecord } from './tariff-storage.types.js';
import { WarehousesRepository } from '../../repositories/warehouses.repository.js';
import { TariffsRepository } from '../../repositories/tariffs.repository.js';

export class TariffStorageService {
    /**
     * Находит или создает запись о складе
     */


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
            // Находим или создаём склад через репозиторий
            const warehouse = await WarehousesRepository.findOrCreate(
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
            await TariffsRepository.upsertTariff(record);
        }
    }

    /**
     * Получает последние тарифы по дню
     */
    async getLatestTariffs(date: string): Promise<any[]> {
        return TariffsRepository.getLatestTariffs(date);
    }
}