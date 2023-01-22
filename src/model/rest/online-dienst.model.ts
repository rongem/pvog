import { MultiLanguageText } from './ml-text.model';
import { RestID } from './rest-id.model';

// XZuFi-OnlineService
// irrelevant für SDG
export interface RestOnlineDienst {
    id: RestID;
    bezeichnung: MultiLanguageText[];
    link: {
        typ: {
            code: string;
            _listURI: string;
            _listVersionID: string;
        },
        link: string;
        titel: string;
        _languageCode: string;
    }[];
    vertrauensniveau: {
        code: string;
        _listURI: string;
        _listVersionID: string;
    },
    sprachversion: {
        languageCode: string;
        sprachbezeichnungDeutsch: string;
        sprachbezeichnungNativ: string;
    },
    _type: string;
}