import { createID } from './id.model';
import { RestLeistung } from './rest/leistung.model';

// ModulText-Objekt erzeugen
export const createText = (leistung: RestLeistung): IModultext[] => leistung.modulText.map(t => {
    // Prüfen, ob ein Inhalt für den Text vorliegt
    if (t.inhalt && t.inhalt.length > 0) {
        return t.inhalt.map(i => {
            // HTML-Tags entfernen
            let text = i.text.replace(/<\/?[^>]+(>|$)/g, '').replace(/^-/, '').trim();
            // Text auf eine Zeile reduzieren (CR+LF durch Leerzeichen ersetzen)
            text = text.replace(/\s/g, ' ').replace(/&#xa0;/g, ' ').replace(/  +/g, ' ');
            // Anzahl der Zeichen ermitteln
            const zeichenAnzahl = text.length;
            // Anzahl der Worte ermitteln
            const wortAnzahl = text.split(' ').length;
            // Anzahl Links ermitteln
            const anzahlLinks = t.weiterfuehrenderLink.length;
            // Text auf 70 Zeichen begrenzen, indem die Mitte herausgeschnitten wird
            if (zeichenAnzahl > 70) {
                text = text.substring(0, text.indexOf(' ', 25) + 1) + '[...]' + text.substring(text.indexOf(' ', zeichenAnzahl - 30));
            }
            // Textobjekt zurückgeben
            return {
                id: createID(leistung.id),
                text,
                leikaTextmodul: t.leikaTextmodul.code,
                position: t.positionDarstellung,
                languageCode: i._languageCode!,
                wortAnzahl,
                zeichenAnzahl,
                anzahlLinks,
                linkOderInhalt: (text && text.length > 0) || anzahlLinks > 0,
            };
        });
    } else {
        // leeres Textobjekt zurückgeben
        return [{
            id: createID(leistung.id),
            leikaTextmodul: t.leikaTextmodul.code,
            position: t.positionDarstellung,
            wortAnzahl: 0,
            zeichenAnzahl: 0,
            anzahlLinks: t.weiterfuehrenderLink.length,
            linkOderInhalt: t.weiterfuehrenderLink.length > 0,
        }];
    }
}).flat();

// Definition ModulText
export interface IModultext {
    id: string;
    leikaTextmodul: string;
    position: string;
    text?: string;
    languageCode?: string;
    wortAnzahl: number;
    zeichenAnzahl: number;
    anzahlLinks: number;
    linkOderInhalt: boolean;
}
