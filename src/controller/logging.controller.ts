import fs from 'fs';

export class Logging {
    private _log: string[] = [];
    private static _logging: Logging;
    private _logfile = '../log.txt';

    private constructor() {}

    public static getInstance() {
        return this._logging || (this._logging = new this());
    }

    public get logLines() { return this._log.join('\n'); }

    public logAction(action: string, objectType: string, id: string, success: string = 'success') {
        this._log.push(`${action} ${objectType} ${id}` + (success !== 'success' ? ' ' + success : ''));
        if (this._log.length > 100000) {
            this.flushLog();
        }
    }

    public clearLog() {
        this._log = [];
    }

    public flushLog() {
        if (!this._log || this._log.length === 0) return;
        const lines = this.logLines;
        fs.appendFileSync(this._logfile, lines);
        this.clearLog();
    }
}