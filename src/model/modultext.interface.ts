import { createID } from './id.model';
import { RestLeistung } from './rest/leistung.model';

export const createText = (leistung: RestLeistung): IModultext[] => leistung.modulText.map(t => {
    if (t.inhalt && t.inhalt.length > 0) {
        return t.inhalt.map(i => {
            let text = i.text.replace(/<\/?[^>]+(>|$)/g, '').replace(/^-/, '').trim();
            text = text.replace(/\s/g, ' ').replace(/&#xa0;/g, ' ').replace(/  +/g, ' ');
            const zeichenAnzahl = text.length;
            const wortAnzahl = text.split(' ').length;
            if (zeichenAnzahl > 70) {
                text = text.substring(0, text.indexOf(' ', 25) + 1) + '[...]' + text.substring(text.indexOf(' ', zeichenAnzahl - 30));
            }
            return {
                id: createID(leistung.id),
                text,
                leikaTextmodul: t.leikaTextmodul.code,
                position: t.positionDarstellung,
                languageCode: i._languageCode!,
                wortAnzahl,
                zeichenAnzahl,
            };
        });
    } else {
        return [{
            id: createID(leistung.id),
            leikaTextmodul: t.leikaTextmodul.code,
            position: t.positionDarstellung,
            wortAnzahl: 0,
            zeichenAnzahl: 0,
        }];
    }
}).flat();

export interface IModultext {
    id: string;
    leikaTextmodul: string;
    position: string;
    text?: string;
    languageCode?: string;
    wortAnzahl: number;
    zeichenAnzahl: number;
}
