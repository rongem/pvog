import { RestID } from './rest-id.model'

// XZuFi-Orgabnisationseinhelt
// irrelevant für SDG, außerdem unzuverlässig gefüllt
export interface RestOrganisationsEinheit {
    id: RestID;
    name: {
        name: {
            text: string;
            _languageCode: string;
        }[];
    };
    anschrift: {
        ort: string;
        verwaltungspolitischeKodierung: {
            bundesland: {
                code: string;
                name: string;
            };
            gemeindeschluessel: {
                code: string;
                name: string;
            };
            regionalschluessel: {
                code: string;
                name: string;
            };
        }
    }[];
}
