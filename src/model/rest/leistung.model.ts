import { MultiLanguageText } from '../ml-text.model';
import { RestID } from './rest-id.model';

export interface RestLeistung {
    id: RestID,
    struktur: {
        leistungsobjektID: {
            text: string,
            _schemeID: string,
            _schemeName: string,
        },
        verrichtung: {
            verrichtungLeiKa: {
                code: string,
                name: string,
                _listURI: string,
              }
        },
        verrichtungsdetail: MultiLanguageText[],
        _type: string
    },
    referenzLeiKa: {
        code: string,
    },
    modulText: {
        positionDarstellung: string,
        inhalt: MultiLanguageText[],
        leikaTextmodul: {code: string},
    }[],
    modulFrist: { beschreibung: MultiLanguageText[] },
    modulKosten: { beschreibung: MultiLanguageText[] },
    modulBearbeitungsdauer: { beschreibung: MultiLanguageText[] },
    modulBegriffImKontext: { begriffImKontext: {
        begriff: MultiLanguageText,
        typ: {code: string}}[]
    },
    modulFachlicheFreigabe: {
        fachlichFreigegebenAm: string,
        fachlichFreigegebenDurch: {
            text: string,
            _languageCode: string,
        }[]
    },
    modulUrsprungsportal: {
        positionDarstellung: string,
        uri: string,
        titel: string,
        _languageCode: string,
    }[],
    typisierung: {
        code: string,
        name: string
    },
    kennzeichenSchriftformerfordernis: boolean,
    kategorie: {
        klasse: {
            id: { text: string }
        },
        id: { text: string},
        uebergeordneteKategorieID: {text: string},
        bezeichnung: {
            text: string,
            _languageCode: string,
        }[],
        beschreibung: {
            text: string,
            _languageCode: string,
        }[]
    },
    informationsbereichSDG: {code: string},
    gueltigkeitGebietID: {
        text: string,
        _schemeID: string,
    },
    kennzeichenEA: false,
    versionsinformation: { geaendertDatumZeit: string },
    sprachversion:   {
        languageCode: string,
        sprachbezeichnungDeutsch: string,
        sprachbezeichnungNativ: string
    }[]
}
