import { createID } from './id.model';
import { RestOnlineDienst } from './rest/online-dienst.model';

// Erzeugt ein Online-Dienst-Objekt aus XZufi
export const createOnlineDienst = (dienst: RestOnlineDienst): OnlineDienst => ({
    id: createID(dienst.id),
    bezeichnung: dienst.bezeichnung[0]?.text ?? dienst.link[0]?.titel,
    links: dienst.link.map(l => l.link),
    anzahlBezeichnungen: dienst.bezeichnung.length,
    anzahlLinks: dienst.link.length,
    anzahlZustaendigkeiten: 0,
});

// Online-Dienst-Objekt
export interface OnlineDienst {
    id: string;
    bezeichnung: string;
    links: string[];
    anzahlBezeichnungen: number;
    anzahlLinks: number;
    anzahlZustaendigkeiten: number;
}
