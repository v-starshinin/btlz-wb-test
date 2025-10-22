import knex from 'knex';
import { Model } from 'objection';
import knexfile from '#config/knex/knexfile.js';

const env = (process.env.NODE_ENV ?? 'development') as 'development' | 'production';
// knexfile exports the correct config for the current NODE_ENV
const config = knexfile;

export const db = knex(config as any);
Model.knex(db);

export default db;