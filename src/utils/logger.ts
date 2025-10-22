import log4js from 'log4js';

log4js.configure({
    appenders: {
        out: { type: 'stdout', layout: { type: 'pattern', pattern: '%[[%d] [%p] [%c]%] %m' } },
        app: {
            type: 'file', filename: 'logs/app.log', maxLogSize: 5 * 1024 * 1024, backups: 5,
            layout: { type: 'pattern', pattern: '[%d] [%p] [%c] %m' }
        }
    },
    categories: {
        default: { appenders: ['out', 'app'], level: 'info' },
        api: { appenders: ['out', 'app'], level: 'info' },
        db: { appenders: ['out', 'app'], level: 'warn' },
        wb: { appenders: ['out', 'app'], level: 'info' },
        google: { appenders: ['out', 'app'], level: 'info' },
    }
});

export const logger = log4js.getLogger();
export const apiLogger = log4js.getLogger('api');
export const dbLogger = log4js.getLogger('db');
export const wbLogger = log4js.getLogger('wb');
export const googleLogger = log4js.getLogger('google');
