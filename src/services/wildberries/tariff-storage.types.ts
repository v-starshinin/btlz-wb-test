// Типы для службы хранения тарифов WB

export interface Warehouse {
    id: number;
    warehouse_name: string;
    geo_name: string;
}

export interface TariffRecord {
    warehouse_id: number;
    day: string;
    fetched_at: Date;
    dt_next_box: string;
    dt_till_max: string;
    box_delivery_base: number;
    box_delivery_coef_expr: number;
    box_delivery_liter: number;
    box_delivery_marketplace_base: number;
    box_delivery_marketplace_coef_expr: number;
    box_delivery_marketplace_liter: number;
    box_storage_base: number;
    box_storage_coef_expr: number;
    box_storage_liter: number;
}
