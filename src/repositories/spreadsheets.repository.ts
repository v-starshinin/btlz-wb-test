import knex from '#postgres/knex.js';
import type { SpreadsheetDbRow } from '../services/googleSheets/types.js';
import { dbLogger } from '../utils/logger.js';

export const SpreadsheetsRepository = {
  async getAll(): Promise<SpreadsheetDbRow[]> {
    dbLogger.debug('Получаем все spreadsheets');
    return await knex<SpreadsheetDbRow>('spreadsheets').select('spreadsheet_id');
  },

  async clear(): Promise<void> {
    dbLogger.info('Очищаем таблицу spreadsheets');
    await knex('spreadsheets').del();
  },

  async insert(spreadsheetId: string): Promise<void> {
    dbLogger.info('Добавление spreadsheet', spreadsheetId);
    await knex('spreadsheets').insert({ spreadsheet_id: spreadsheetId });
  }
};
