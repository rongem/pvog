import { RestLeistung } from './rest/leistung.model';
import { MultiLanguageText } from './ml-text.model';
import { createID } from './id.model';

const analyzeText = (i: MultiLanguageText): { wortAnzahl: number; zeichenAnzahl: number; languageCode: string; } => {
    const cleanedText = i.text.replace(/<\/?[^>]+(>|$)/g, '');
    return {
        wortAnzahl: cleanedText.split(' ').length,
        zeichenAnzahl: cleanedText.length,
        languageCode: i._languageCode!,
    };
};
const getMultiLanguage = (b: { text: string; _languageCode: string; }): { text: string; languageCode: string; } => ({
    text: b.text,
    languageCode: b._languageCode,
});

export const createLeistung = (leistung: RestLeistung): ILeistung => ({
    id: createID(leistung.id),
    informationsbereichSDG: leistung.informationsbereichSDG?.code,
    SDG: leistung.informationsbereichSDG ? 'Ja' : 'Nein',
    kategorie: !!leistung.kategorie ? {
        bezeichnung: !leistung.kategorie.bezeichnung ? [] :
            typeof leistung.kategorie.bezeichnung.map === 'function' ? leistung.kategorie.bezeichnung.map(getMultiLanguage) :
            [getMultiLanguage(leistung.kategorie.bezeichnung as any)],
        beschreibung: !leistung.kategorie.beschreibung ? [] :
            typeof leistung.kategorie.beschreibung.map === 'function' ? leistung.kategorie.beschreibung.map(getMultiLanguage) :
            [getMultiLanguage(leistung.kategorie.beschreibung as any)],
        klasse: leistung.kategorie.klasse?.id.text,
    } : undefined,
    modulText: leistung.modulText?.map(t => ({
        leikaTextModul: t.leikaTextmodul.code,
        position: t.positionDarstellung,
        inhalt: t.inhalt && typeof t.inhalt?.map === 'function' ? [...t.inhalt].map(analyzeText) ?? [] :
            !!t.inhalt ? [t.inhalt as unknown as MultiLanguageText].map(analyzeText) : [],
    })) ?? [],
    struktur: !!leistung.struktur ? {
        leistungsobjekt: !!leistung.struktur.leistungsobjektID ? {
            ID: leistung.struktur.leistungsobjektID.text,
            schemeID: leistung.struktur.leistungsobjektID._schemeID,
            schemeName: leistung.struktur.leistungsobjektID._schemeName,
        } : undefined,
        type: leistung.struktur._type,
        verrichtung: !!leistung.struktur.verrichtung ? {
            code: leistung.struktur.verrichtung.verrichtungLeiKa.code,
            name: leistung.struktur.verrichtung.verrichtungLeiKa.name,
            listUri: leistung.struktur.verrichtung.verrichtungLeiKa._listURI,
        } : undefined,
        verrichtungsDetail: leistung.struktur.verrichtungsdetail ? {
            text: leistung.struktur.verrichtungsdetail?.text,
            languageCode: leistung.struktur.verrichtungsdetail?._languageCode,
        } : undefined,
    } : undefined,
    typisierung: leistung.typisierung.code,
    anzahlServices: 0,
    anzahlOEs: 0,
    zuletztGeandert: leistung.versionsinformation?.geaendertDatumZeit,
});

export interface ILeistung {
    id: string;
    informationsbereichSDG?: string;
    SDG: 'Ja' | 'Nein';
    kategorie?: {
        bezeichnung: MultiLanguageText[];
        beschreibung: MultiLanguageText[];
        klasse: string;
    };
    modulText: {
        inhalt: {
            wortAnzahl: number;
            zeichenAnzahl: number;
            languageCode: string;
        }[];
        leikaTextModul: string;
        position: string;
    }[];
    struktur?: {
        leistungsobjekt?: {
            ID: string;
            schemeID: string;
            schemeName: string;
        };
        type: string;
        verrichtung?: {
            code: string;
            name: string;
            listUri: string;
        };
        verrichtungsDetail?: MultiLanguageText;
    };
    typisierung: string;
    anzahlServices: number;
    anzahlOEs: number;
    zuletztGeandert: string;
}

