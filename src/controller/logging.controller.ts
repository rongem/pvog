export class Logging {
    private _log: string[] = [];
    private static _logging: Logging;

    private constructor() {}

    public static getInstance() {
        return this._logging || (this._logging = new this());
    }

    public get logLines() { return this._log.join('\n'); }

    public logAction(action: string, objectType: string, id: string, success: string = 'success') {
        this._log.push(`${action} ${objectType} ${id}` + (success !== 'success' ? ' ' + success : ''));
    }

    public clearLog() {
        this._log = [];
    }
}