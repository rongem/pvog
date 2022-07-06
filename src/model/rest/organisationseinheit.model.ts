import { RestID } from './rest-id.model'

export interface RestOrganisationsEinheit {
    id: RestID;
    name: {
        name: {
            text: string;
            _languageCode: string;
        }
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
