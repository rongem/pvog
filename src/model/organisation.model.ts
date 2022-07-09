import { createID } from './id.model';
import { RestOrganisationsEinheit } from './rest/organisationseinheit.model';

export interface Organisation {
    id: string;
    name: string;
    languageCode: string;
    primaeresBundesland?: string;
    orte: {
        ort: string;
        bundesland: string;
        gemeinde: string;
        // gemeindeName: string;
        ars: string;
        // arsName: string;
    }[];
}

export const createOrganisation = (orgEinheit: RestOrganisationsEinheit): Organisation => {
    if (!orgEinheit.anschrift) {
        orgEinheit.anschrift = [];
    }
    if (orgEinheit.anschrift && typeof orgEinheit.anschrift.map !== 'function') {
        orgEinheit.anschrift = [orgEinheit.anschrift as any];
    }
    return {
        id: createID(orgEinheit.id),
        name: orgEinheit.name.name.text,
        languageCode: orgEinheit.name.name._languageCode,
        primaeresBundesland: orgEinheit.anschrift?.find(a => a.verwaltungspolitischeKodierung?.bundesland?.code)?.verwaltungspolitischeKodierung.bundesland.code,
        orte: orgEinheit.anschrift.map(anschrift => ({
            ort: anschrift.ort,
            bundesland: anschrift.verwaltungspolitischeKodierung?.bundesland?.code,
            gemeinde: anschrift.verwaltungspolitischeKodierung?.gemeindeschluessel?.code,
            // gemeindeName: anschrift.verwaltungspolitischeKodierung?.gemeindeschluessel?.name,
            ars: anschrift.verwaltungspolitischeKodierung?.regionalschluessel?.code,
            // arsName: anschrift.verwaltungspolitischeKodierung?.regionalschluessel?.name,
        }))
    };
};

