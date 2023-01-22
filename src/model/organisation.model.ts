import { createID } from './id.model';
import { RestOrganisationsEinheit } from './rest/organisationseinheit.model';

// Organisationsobjekt
// irrelevant für SDG, außerdem unzuverlässig
export interface Organisation {
    id: string;
    name: string;
    languageCode: string;
    primaeresBundesland?: string;
    orte: {
        ort: string;
        bundesland: string;
        gemeinde: string;
        ars: string;
    }[];
}

// Erzeugt eine Organisation aus einem XZuFi-Objekt
export const createOrganisation = (orgEinheit: RestOrganisationsEinheit): Organisation => {
    // Anschriften in ein Array verwandeln, falls das nicht gegeben ist
    if (!orgEinheit.anschrift) {
        orgEinheit.anschrift = [];
    }
    if (orgEinheit.anschrift && typeof orgEinheit.anschrift.map !== 'function') {
        orgEinheit.anschrift = [orgEinheit.anschrift as any];
    }
    // Objekt zurückgeben
    return {
        id: createID(orgEinheit.id),
        name: orgEinheit.name.name.find(n => n._languageCode === 'de')?.text ?? '',
        languageCode: orgEinheit.name.name[0]?._languageCode,
        primaeresBundesland: orgEinheit.anschrift?.find(a => a.verwaltungspolitischeKodierung?.bundesland?.code)?.verwaltungspolitischeKodierung.bundesland.code,
        orte: orgEinheit.anschrift.map(anschrift => ({
            ort: anschrift.ort,
            bundesland: anschrift.verwaltungspolitischeKodierung?.bundesland?.code,
            gemeinde: anschrift.verwaltungspolitischeKodierung?.gemeindeschluessel?.code,
            ars: anschrift.verwaltungspolitischeKodierung?.regionalschluessel?.code,
        }))
    };
};

