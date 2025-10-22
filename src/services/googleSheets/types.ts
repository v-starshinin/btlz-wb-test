// Типы для экспорта тарифов в Google Sheets

export interface SpreadsheetDbRow {
    spreadsheet_id: string;
}

export interface TariffRow {
    day: string;
    fetched_at: string | Date;
    dt_next_box: string;
    dt_till_max: string;
    warehouse_name: string;
    geo_name: string;
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
