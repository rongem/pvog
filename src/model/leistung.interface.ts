import { RestLeistung } from './rest/leistung.model';
import { MultiLanguageText } from './ml-text.model';
import { createID } from './id.model';
import { AnalyzedText } from './rest/analyzed-text.model';

const analyzeText = (i: MultiLanguageText): { wortAnzahl: number; zeichenAnzahl: number; languageCode: string; } => {
    const cleanedText = i.text.replace(/<\/?[^>]+(>|$)/g, '');
    return {
        wortAnzahl: cleanedText.split(' ').length,
        zeichenAnzahl: cleanedText.length,
        languageCode: i._languageCode!,
    };
};
const getMultiLanguage = (b: MultiLanguageText): { text: string; languageCode: string; } => ({
    text: b.text,
    languageCode: b._languageCode!,
});

export const createLeistung = (leistung: RestLeistung): ILeistung => ({
    id: createID(leistung.id),
    informationsbereichSDG: leistung.informationsbereichSDG?.code,
    SDG: leistung.informationsbereichSDG ? 'Ja' : 'Nein',
    kategorie: !!leistung.kategorie ? {
        bezeichnung: leistung.kategorie.bezeichnung.map(getMultiLanguage),
        beschreibung: leistung.kategorie.beschreibung.map(analyzeText),
        klasse: leistung.kategorie.klasse?.id.text,
    } : undefined,
    modulText: leistung.modulText?.map(t => ({
        leikaTextModul: t.leikaTextmodul?.code,
        position: t.positionDarstellung,
        inhalt: t.inhalt.map(analyzeText),
    })) ?? [],
    struktur: !!leistung.struktur ? {
        leistungsobjekt: !!leistung.struktur.leistungsobjektID ? {
            ID: leistung.struktur.leistungsobjektID.text,
            schemeID: leistung.struktur.leistungsobjektID._schemeID,
            schemeName: leistung.struktur.leistungsobjektID._schemeName,
        } : undefined,
        type: leistung.struktur._type.replace('xzufi:Leistungsstruktur', ''),
        verrichtung: !!leistung.struktur.verrichtung ? {
            code: leistung.struktur.verrichtung.verrichtungLeiKa.code,
            name: leistung.struktur.verrichtung.verrichtungLeiKa.name,
            listUri: leistung.struktur.verrichtung.verrichtungLeiKa._listURI,
        } : undefined,
        verrichtungsDetail: leistung.struktur.verrichtungsdetail.map(getMultiLanguage),
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
        beschreibung: AnalyzedText[];
        klasse: string;
    };
    modulText: {
        inhalt: AnalyzedText[];
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
        verrichtungsDetail: MultiLanguageText[];
    };
    typisierung: string;
    anzahlServices: number;
    anzahlOEs: number;
    zuletztGeandert: string;
}

