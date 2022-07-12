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

const sum = (arr: number[]): number => {
    let sum = 0;
    arr.forEach(n => sum += n);
    return sum;
}

export const createLeistung = (leistung: RestLeistung): ILeistung => ({
    id: createID(leistung.id),
    informationsbereichSDG: leistung.informationsbereichSDG?.code,
    SDG: leistung.informationsbereichSDG ? 'Ja' : 'Nein',
    kategorie: leistung.kategorie.map(kategorie => ({
        bezeichnung: kategorie.bezeichnung.map(getMultiLanguage),
        beschreibung: kategorie.beschreibung.map(analyzeText),
        klasse: kategorie.klasse.filter(k => k.bezeichnung._languageCode === 'de').map(k => k.bezeichnung.text),
    })),
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
        anzahlVerrichtungsdetails: leistung.struktur.verrichtungsdetail.length,
    } : undefined,
    typisierung: leistung.typisierung.map(t => t.code),
    primaereTypisierung: leistung.typisierung[0]?.code,
    anzahlTypisierungen: leistung.typisierung.length,
    anzahlServices: 0,
    anzahlOEs: 0,
    anzahlKategorien: leistung.kategorie.length,
    anzahlKategorieBeschreibungen: sum(leistung.kategorie.map(k => k.beschreibung.length)),
    anzahlKategorieBeschreibungenOhneInhalt: sum(leistung.kategorie.map(k => k.beschreibung.filter(b => !b.text).length)),
    anzahlKategorieBezeichnungen: sum(leistung.kategorie.map(k => k.bezeichnung.length)),
    zuletztGeandert: leistung.versionsinformation?.geaendertDatumZeit,
});

export interface ILeistung {
    id: string;
    informationsbereichSDG?: string;
    SDG: 'Ja' | 'Nein';
    kategorie: {
        bezeichnung: MultiLanguageText[];
        beschreibung: AnalyzedText[];
        klasse: string[];
    }[];
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
        anzahlVerrichtungsdetails: number;
    };
    typisierung: string[];
    primaereTypisierung: string;
    anzahlTypisierungen: number;
    anzahlServices: number;
    anzahlOEs: number;
    anzahlKategorien: number;
    anzahlKategorieBeschreibungen: number;
    anzahlKategorieBeschreibungenOhneInhalt: number;
    anzahlKategorieBezeichnungen: number;
    zuletztGeandert: string;
}

