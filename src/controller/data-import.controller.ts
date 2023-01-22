import axios from 'axios';
import { XMLParser} from "fast-xml-parser";
import { Content } from '../model/content.model';
import { createID } from '../model/id.model';
import { RestLeistung } from '../model/rest/leistung.model';
import { RestOnlineDienst } from '../model/rest/online-dienst.model';
import { RestOrganisationsEinheit } from '../model/rest/organisationseinheit.model';
import { Token } from '../model/token.model';
import { Logging } from './logging.controller';
import { Storage } from './storage.controller';

export class DataImport {
    private storage = new Storage();
    private authUrl = process.env.AUTH_URL ?? 'error: missing AUTH_URL env variable';
    private log = Logging.getInstance();
    private token!: Token;
    private ctr = 0;
    private parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix : "_",
        removeNSPrefix: true,
        textNodeName: 'text',
        numberParseOptions: {leadingZeros: true, hex: false, skipLike: /[0-9]+/}
    });
    
    // Authentifizierung am System
    getToken = async () => {
        const content = new URLSearchParams({
            'grant_type': 'client_credentials',
            'client_id': process.env.USER ?? '',
            'client_secret': process.env.PASSWORD ?? ''
        }).toString();
        const result = await axios.post(this.authUrl, content, {headers: {'Content-Type': 'application/x-www-form-urlencoded'}});
        return new Token(result.data['token_type'], result.data['access_token']);
    }
    
    // nächsten Block aus dem Cache bzw. vom PVOG holen
    getNextContent = async (currentId: number, url: string): Promise<Content> => {
        // zuerst prüfen, ob bereits im Cache die Informationen vorhanden sind
        let fileContent = this.storage.loadContent(currentId);
        if (fileContent) {
            // falls ja direkt die Daten zurückgeben, sofern es sich nicht um ein leeres Objekt handelt
            const rootNode = Object.keys(fileContent.content).find(n => n !== '?xml')!;
            if (fileContent.content[rootNode]) {
                // if (this.sanitizeContent(fileContent.content)) {
                //     console.log('sanitized');
                //     this.storage.saveContent(fileContent.content, currentId, fileContent.nextIndex, fileContent.url);
                //     fileContent = this.storage.loadContent(currentId)!;
                // }
                return fileContent;
            }
        }
        // Authentifizierungstoken holen bzw. erneuern
        if (!this.token || this.token.expired) {
            this.token = await this.getToken();
        }
        // Inhalt vom Bereitstelldienst lesen und in JSON konvertireen
        const result = await axios.get(url, {headers: {'Authorization': this.token.authorization}});
        const xmlContent = (result.data['xzufiObjekte'] as string);
        const content = this.parser.parse(xmlContent);
        // Inhalt bereinigen
        this.sanitizeContent(content);
        // Inhalt im Cache speichern
        fileContent = {
            complete: result.data['vollstaendig'] as boolean,
            content,
            fromFile: false,
            nextIndex: result.data['naechsterIndex'] as number,
            url: result.data['naechsteAnfrageUrl'] as string,
        };
        this.storage.saveContent(fileContent.content, currentId, fileContent.nextIndex, fileContent.url);
        // Inhalt zurückgeben
        return fileContent;
    }
    
    // Synchronisationslauf durchführen
    getData = async () => {
        // Startzeit für statistische Zwecke holen
        const startTime = Date.now();
        // Content initialisieren
        let content: Content = {complete: false, nextIndex: this.storage.nextIndex, url: this.storage.startURL, content: undefined, fromFile: false};
        // In einer Schleife alle Content-Objekte lesen
        while(!content.complete) {
            // Der PVOG löscht Zuständigkeiten auch rückwirkend, behält aber die Löschung bei. Dadurch entstehen mehrere Millionen verwaiste Löschungen
            const orphanedDeletions: number[] = [];
            // Aktuelle Position und URL ausgeben
            console.log(this.ctr++, content.url);
            // Zähler aktualisieren
            const currentId = content.nextIndex;
            // this.log.logAction('fetching', 'url #' + this.ctr, content.url);
            // Nächsten Block holen
            content = await this.getNextContent(currentId, content.url);
            // Sofern Inhalt vorliegt, diesen anaylisieren
            if (content.content) {
                // Ersten Knoten finden, der nicht der XML-Knoten ist
                const rootNode = Object.keys(content.content).find(n => n !== '?xml')!;
                // Sofern ein solcher Knoten existiert (es gibt auch leere Antworten), ...
                if (content.content[rootNode]) {
                    // XZuFi kennt zwei primäre Knotentypen: schreibe für create und update und loesche für delete
                    let writables = content.content[rootNode]['schreibe'] as Array<any>;
                    let deletables = content.content[rootNode]['loesche'] as Array<any>;
                    if (writables) {
                        // Für jedes schreibe untersuchen, um was es sich handelt, und die entsprechenden Daten erzeugen
                        writables.forEach(entry => {
                            switch (Object.keys(entry)[0]) {
                                case 'leistung':
                                    this.storage.addLeistung(entry['leistung']);
                                    this.storage.addText(entry['leistung']);
                                    break;
                                case 'organisationseinheit':
                                    this.storage.addOrganisationsEinheit(entry['organisationseinheit']);
                                    break;
                                case 'zustaendigkeitTransferObjekt':
                                    this.storage.addZustaendigkeit(entry[Object.keys(entry)[0]]);
                                    break;
                                case 'spezialisierung':
                                    break;
                                case 'onlinedienst':
                                    this.storage.addService(entry[Object.keys(entry)[0]]);
                                    break;
                                default:
                                    this.log.logAction('ignore', 'write object handlers', Object.keys(entry)[0], 'failed');
                                    break;
                            }
                        });
                    }
                    if (deletables) {
                        // es kommt vor, dass nur ein einzelnes loesche-Objekt existiert, deshalb sicherstellen, dass es in einem Array liegt
                        // Für schreibe geschieht dies bereits in der Sanitize-Funktion, weshalb es hier kein zweites Mal getan wird
                        if (typeof deletables.forEach !== 'function') {
                            deletables = [deletables as any];
                        }
                        // Analysieren, um welches Objekttyp es sich handelt, und entsprechend verfahren
                        deletables.forEach((entry, index) => {
                            const id = createID(entry.id);
                            switch(entry._klasse) {
                                case 'Zustaendigkeit':
                                    // Verwaiste Löschungen von Zuständigkeiten erkennen
                                    if (!this.storage.removeZustaendigkeit(id)) {
                                        orphanedDeletions.push(index);
                                    }
                                    break;
                                case 'Leistung':
                                    this.storage.removeLeistung(id);
                                    break;
                                case 'Organisationseinheit':
                                    this.storage.removeOrganisationseinheit(id);
                                    break;
                                case 'LeistungSpezialisierung':
                                    break;
                                case 'Onlinedienst':
                                    this.storage.removeService(id);
                                    break;
                                default:
                                    this.log.logAction('ignore', 'delete object handlers', entry._klasse, 'failed');
                                    break;
                            }
                        });
                    }
                    // Sofern verwaiste Löschungen enthalten sind, diese aus dem XZuFi entfernen, um Zeit zu sparen, und Datei neu speichern
                    if (orphanedDeletions.length > 0) {
                        orphanedDeletions.reverse().forEach(d => deletables.splice(d, 1));
                        this.storage.saveContent(content.content, currentId, content.nextIndex, content.url);
                    }
                }
            }
        }
        // Zeit für den Durchlauf in Minuten angeben
        console.log(
            'Minuten:', Math.round((Date.now().valueOf() - startTime) / 6000) / 10,
        );
        // Speichern der In-Memory-Datenbank, und Zeit dafür angeben
        this.storage.saveData(content.url, content.nextIndex);
        console.log('Minuten:', Math.round((Date.now().valueOf() - startTime) / 6000) / 10);
    }

    // Korrigieren von XML-Formatproblemen. XML kennt keine Arrays, weshalb beim Parsen häufig keine Eigenschaft oder ein Objekt gesetzt wird.
    private sanitizeContent(content: any): boolean {
        // Root-Node ist der erste Node, der nicht ?xml heißt.
        const rootNode = Object.keys(content).find(n => n !== '?xml')!;
        // Abbrechen, wenn kein Rootnode vorhanden ist.
        if (!content[rootNode]) return false;
        // Prüfen, ob sich unbekannte Node-Typen im XML befinden, und diese protokollieren
        const nodes = Object.keys(content[rootNode]).filter(n => !['schreibe', 'loesche', 'nachrichtenkopf', '_produktbezeichnung', '_produkthersteller', '_xzufiVersion'].includes(n));
        if (nodes.length > 0) {
            this.log.logAction('Extracting', 'unknown node types', nodes.join(', '), 'failed');
        }
        // Nur Nodes vom Typ schreibe müssen korrigiert werden
        let schreibe = content[rootNode]['schreibe'];
        let changed = false;
        if (schreibe) {
            // Prüfen, ob nicht nur ein Node vom Typ schreibe vorliegt, und diesen ggf. in ein Array verwandeln
            if (typeof schreibe.forEach !== 'function') {
                content[rootNode]['schreibe'] = [schreibe];
                schreibe = content[rootNode]['schreibe'];
                changed = true;
            }
            // Prüfen, welcher Typ vorliegt, und entsprechend bereinigen
            // Nicht alle Typen sind relevant, daher einiges auskommentiert
            schreibe.forEach((entry: any) => {
                switch (Object.keys(entry)[0]) {
                    case 'leistung':
                        changed = this.sanitizeLeistung(entry['leistung']) || changed;
                        break;
                    case 'organisationseinheit':
                        changed = this.sanitizeOrganisationsEinheit(entry['organisationseinheit']) || changed;
                        break;
                    // case 'zustaendigkeitTransferObjekt':
                    //     break;
                    // case 'spezialisierung':
                    //     break;
                    case 'onlinedienst':
                        changed = this.sanitizeOnlineDienst(entry['onlinedienst']) || changed;
                        break;
                    default:
                        break;
                }
            });
        }
        // Loesche-Knoten ebenfalls in ein Array verwandeln. Ggf. redundant?
        const loesche = content[rootNode]['loesche'];
        if (loesche) {
            if (typeof loesche.forEach !== 'function') {
                content[rootNode]['loesche'] = [loesche];
                changed = true;
            }
        }
        // Gibt an, ob etwas geändert wurde, und ggf. neu gespeichert werden muss.
        return changed;
    }

    // ein Leistungsobjekt bereinigen. Überall, wo ein Array sein müsste, wird eines erzeugt, entweder leer oder mit nur einem Element.
    private sanitizeLeistung(restLeistung: RestLeistung): boolean {
        let changed = false;
        if (restLeistung.struktur) {
            if (!restLeistung.struktur.verrichtungsdetail) {
                restLeistung.struktur.verrichtungsdetail = [];
                changed = true;
            } else if (typeof restLeistung.struktur.verrichtungsdetail.map !== 'function') {
                restLeistung.struktur.verrichtungsdetail = [restLeistung.struktur.verrichtungsdetail as any];
                changed = true;
            } else if (restLeistung.struktur.verrichtungsdetail[0] && typeof (restLeistung.struktur.verrichtungsdetail[0] as any).map === 'function') {
                while (restLeistung.struktur.verrichtungsdetail[0] && typeof (restLeistung.struktur.verrichtungsdetail[0] as any).map === 'function') {
                    restLeistung.struktur.verrichtungsdetail = restLeistung.struktur.verrichtungsdetail.flat();
                }
                changed = true;
            }
        }
        if (!restLeistung.informationsbereichSDG) {
            restLeistung.informationsbereichSDG = [];
            changed = true;
        } else if (typeof restLeistung.informationsbereichSDG.map !== 'function') {
            restLeistung.informationsbereichSDG = [restLeistung.informationsbereichSDG as any];
            changed = true;
        }
        if (!restLeistung.kategorie) {
            restLeistung.kategorie = [];
            changed = true;
        } else if (typeof restLeistung.kategorie.map !== 'function') {
            restLeistung.kategorie = [restLeistung.kategorie as any];
            changed = true;
        }
        restLeistung.kategorie.forEach(kategorie => {
            if (!kategorie.bezeichnung) {
                kategorie.bezeichnung = [];
                changed = true;
            } else if (typeof kategorie.bezeichnung.map !== 'function') {
                kategorie.bezeichnung = [kategorie.bezeichnung as any];
                changed = true;
            }
            if (!kategorie.beschreibung) {
                kategorie.beschreibung = [];
                changed = true;
            } else if (typeof kategorie.beschreibung.map !== 'function') {
                kategorie.beschreibung = [kategorie.beschreibung as any];
                changed = true;
            }
            if (!kategorie.klasse) {
                kategorie.klasse = [];
                changed = true;
            } else if (typeof kategorie.klasse.map !== 'function') {
                kategorie.klasse = [kategorie.klasse as any];
                changed = true;
            }
        });
        if (!restLeistung.referenzLeiKa) {
            restLeistung.referenzLeiKa = [];
            changed = true;
        } else if (typeof restLeistung.referenzLeiKa.map !== 'function') {
            restLeistung.referenzLeiKa = [restLeistung.referenzLeiKa as any];
            changed = true;
        }
        if (!restLeistung.typisierung) {
            restLeistung.typisierung = [];
            changed = true;
        } else if (typeof restLeistung.typisierung.map !== 'function') {
            restLeistung.typisierung = [restLeistung.typisierung as any];
                changed = true;
        }
        if (!restLeistung.modulText) {
            restLeistung.modulText = [];
            changed = true;
        } else if (typeof restLeistung.modulText.map !== 'function') {
            restLeistung.modulText = [restLeistung.modulText as any];
                changed = true;
        }
        restLeistung.modulText.forEach(text => {
            if (!text.inhalt) {
                text.inhalt = [];
                changed = true;
            } else if (typeof text.inhalt.map !== 'function') {
                text.inhalt = [text.inhalt as any];
                changed = true;
            }
            if (!text.weiterfuehrenderLink) {
                text.weiterfuehrenderLink = [];
                changed = true;
            } else if (typeof text.weiterfuehrenderLink.map !== 'function') {
                text.weiterfuehrenderLink = [text.weiterfuehrenderLink as any];
                changed = true;
            }
        });
        if (!restLeistung.sprachversion) {
            restLeistung.sprachversion = [];
            changed = true;
        } else if (typeof restLeistung.sprachversion.map !== 'function') {
            restLeistung.sprachversion = [restLeistung.sprachversion as any];
            changed = true;
        }
        if (!restLeistung.modulBearbeitungsdauer) {
            restLeistung.modulBearbeitungsdauer = {
                beschreibung: []
            };
            changed = true;
        } else if (!restLeistung.modulBearbeitungsdauer.beschreibung) {
            restLeistung.modulBearbeitungsdauer.beschreibung = [];
            changed = true;
        } else if (typeof restLeistung.modulBearbeitungsdauer.beschreibung.map !== 'function') {
            restLeistung.modulBearbeitungsdauer.beschreibung = [restLeistung.modulBearbeitungsdauer.beschreibung as any];
            changed = true;
        }
        if (!restLeistung.modulBegriffImKontext) {
            restLeistung.modulBegriffImKontext = [];
            changed = true;
        } else if (typeof restLeistung.modulBegriffImKontext.map !== 'function'){
            restLeistung.modulBegriffImKontext = [restLeistung.modulBegriffImKontext as any];
            changed = true;
        }
        restLeistung.modulBegriffImKontext.forEach(bik => {
            if (!bik.begriffImKontext) {
                bik.begriffImKontext = [];
                changed = true;
            } else if (typeof bik.begriffImKontext.map !== 'function') {
                bik.begriffImKontext = [bik.begriffImKontext as any];
                changed = true;
            }
        });
        if (restLeistung.modulFachlicheFreigabe) {
            if (!restLeistung.modulFachlicheFreigabe.fachlichFreigegebenDurch) {
                restLeistung.modulFachlicheFreigabe.fachlichFreigegebenDurch = [];
                changed = true;
            } else if (typeof restLeistung.modulFachlicheFreigabe.fachlichFreigegebenDurch.map !== 'function') {
                restLeistung.modulFachlicheFreigabe.fachlichFreigegebenDurch = [restLeistung.modulFachlicheFreigabe.fachlichFreigegebenDurch as any];
                changed = true;
            }
        }
        if (!restLeistung.modulFrist) {
            restLeistung.modulFrist = {
                beschreibung: []
            };
            changed = true;
        } else if (!restLeistung.modulFrist.beschreibung) {
            restLeistung.modulFrist.beschreibung = [];
            changed = true;
        } else if (typeof restLeistung.modulFrist.beschreibung.map !== 'function') {
            restLeistung.modulFrist.beschreibung = [restLeistung.modulFrist.beschreibung as any];
            changed = true;
        }
        if (!restLeistung.modulKosten) {
            restLeistung.modulKosten = {
                beschreibung: []
            };
            changed = true;
        } else if (!restLeistung.modulKosten.beschreibung) {
            restLeistung.modulKosten.beschreibung = [];
            changed = true;
        } else if (typeof restLeistung.modulKosten.beschreibung.map !== 'function') {
            restLeistung.modulKosten.beschreibung = [restLeistung.modulKosten.beschreibung as any];
            changed = true;
        }
        if (!restLeistung.modulBearbeitungsdauer) {
            restLeistung.modulBearbeitungsdauer = {
                beschreibung: []
            };
            changed = true;
        } else if (!restLeistung.modulBearbeitungsdauer.beschreibung) {
            restLeistung.modulBearbeitungsdauer.beschreibung = [];
            changed = true;
        } else if (typeof restLeistung.modulBearbeitungsdauer.beschreibung.map !== 'function') {
            restLeistung.modulBearbeitungsdauer.beschreibung = [restLeistung.modulBearbeitungsdauer.beschreibung as any];
            changed = true;
        }
        if (!restLeistung.modulUrsprungsportal) {
            restLeistung.modulUrsprungsportal = [];
            changed = true;
        } else if (typeof restLeistung.modulUrsprungsportal.map !== 'function') {
            restLeistung.modulUrsprungsportal = [restLeistung.modulUrsprungsportal as any];
            changed = true;
        } else if (restLeistung.modulUrsprungsportal[0] && typeof (restLeistung.modulUrsprungsportal[0] as any).map === 'function') {
            while (restLeistung.modulUrsprungsportal[0] && typeof (restLeistung.modulUrsprungsportal[0] as any).map === 'function') {
                restLeistung.modulUrsprungsportal = restLeistung.modulUrsprungsportal.flat();
            }
            changed = true;
        }
        return changed;
    }

    // Bereinige Organisationseinheiten. Überall, wo ein Array sein müsste, wird eines erzeugt, entweder leer oder mit nur einem Element.
    private sanitizeOrganisationsEinheit(oe: RestOrganisationsEinheit): boolean {
        let changed = false;
        if (oe.name) {
            if (!oe.name.name) {
                oe.name.name = [];
                changed = true;
            } else if (typeof oe.name.name.map !== 'function') {
                oe.name.name = [oe.name.name as any];
                changed = true;
            }
        }
        if (!oe.anschrift) {
            oe.anschrift = [];
            changed = true;
        } else if (typeof oe.anschrift.map !== 'function') {
            oe.anschrift = [oe.anschrift as any];
            changed = true;
        }
        return changed;
    }

    // Bereinige OnlineDienste. Überall, wo ein Array sein müsste, wird eines erzeugt, entweder leer oder mit nur einem Element.
    private sanitizeOnlineDienst(sv: RestOnlineDienst): boolean {
        let changed = false;
        if (!sv.bezeichnung) {
            sv.bezeichnung = [];
            changed = true;
            // console.log(1);
        } else if (typeof sv.bezeichnung.map !== 'function') {
            sv.bezeichnung = [sv.bezeichnung as any];
            changed = true;
            // console.log(2);
        }
        if (!sv.link) {
            sv.link = [];
            changed = true;
            // console.log(3);
        } else if (typeof sv.link.map !== 'function') {
            sv.link = [sv.link as any];
            changed = true;
            // console.log(4);
        }
        return changed;
    }
            
}