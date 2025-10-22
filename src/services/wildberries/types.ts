// Типы и интерфейсы для работы с тарифами WB

/**
 * Тарифы склада (короба)
 */
export interface WarehouseTariff {
    boxDeliveryBase: string;
    boxDeliveryCoefExpr: string;
    boxDeliveryLiter: string;
    boxDeliveryMarketplaceBase: string;
    boxDeliveryMarketplaceCoefExpr: string;
    boxDeliveryMarketplaceLiter: string;
    boxStorageBase: string;
    boxStorageCoefExpr: string;
    boxStorageLiter: string;
    geoName: string;
    warehouseName: string;
}

/**
 * Данные по всем тарифам на дату
 */
export interface TariffData {
    dtNextBox: string;
    dtTillMax: string;
    warehouseList: WarehouseTariff[];
}

/**
 * Ответ API тарифа коробов
 */
export interface BoxTariffResponse {
    response: {
        data: TariffData;
    };
}

/**
 * Структурированная ошибка API WB
 */
export type ProblemResponse = {
    title?: string;
    detail?: string;
    code?: string;
    requestId?: string;
    origin?: string;
    status?: number;
    timestamp?: string;
};


