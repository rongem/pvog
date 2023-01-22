import { decode, JwtPayload } from 'jsonwebtoken';

// Authentifizierungs-Token für PVOG
export class Token {
    private _token: string;
    private _obj: JwtPayload;
    private _exp: number;

    public get authorization() { return this._token }

    public get expired() { return Date.now().valueOf() + 5000 >= this._exp }

    constructor(type: string, content: string) {
        this._token = type + ' ' + content;
        this._obj = decode(content) as JwtPayload;
        this._exp = +this._obj.exp! * 1000;
    }
}