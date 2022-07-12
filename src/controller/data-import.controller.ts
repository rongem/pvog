import axios from 'axios';
import { XMLParser} from "fast-xml-parser";
import { Content } from '../model/content.model';
import { createID } from '../model/id.model';
import { RestLeistung } from '../model/rest/leistung.model';
import { RestOrganisationsEinheit } from '../model/rest/organisationseinheit.model';
import { Token } from '../model/token.model';
import { Logging } from './logging.controller';
import { Storage } from './storage.controller';

export class DataImport {
    private storage = new Storage();
    private authUrl = 'https://private.demo.pvog.dataport.de/auth/realms/pvog/protocol/openid-connect/token';
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
    
    getToken = async () => {
        const content = new URLSearchParams({
            'grant_type': 'client_credentials',
            'client_id': process.env.USER ?? '',
            'client_secret': process.env.PASSWORD ?? ''
        }).toString();
        const result = await axios.post(this.authUrl, content, {headers: {'Content-Type': 'application/x-www-form-urlencoded'}});
        return new Token(result.data['token_type'], result.data['access_token']);
    }
    
    getNextContent = async (currentId: number, url: string): Promise<Content> => {
        let fileContent = this.storage.loadContent(currentId);
        if (fileContent) {
            const rootNode = Object.keys(fileContent.content).find(n => n !== '?xml')!;
            if (fileContent.content[rootNode]) {
                if (this.sanitizeContent(fileContent.content)) {
                    console.log('sanitized');
                    this.storage.saveContent(fileContent.content, currentId, fileContent.nextIndex, fileContent.url);
                    fileContent = this.storage.loadContent(currentId)!;
                }
                return fileContent;
            }
        }
        if (!this.token || this.token.expired) {
            this.token = await this.getToken();
        }
        const result = await axios.get(url, {headers: {'Authorization': this.token.authorization}});
        const xmlContent = (result.data['xzufiObjekte'] as string);
        const content = this.parser.parse(xmlContent);
        this.sanitizeContent(content);
        fileContent = {
            complete: result.data['vollstaendig'] as boolean,
            content,
            fromFile: false,
            nextIndex: result.data['naechsterIndex'] as number,
            url: result.data['naechsteAnfrageUrl'] as string,
        };
        this.storage.saveContent(fileContent.content, currentId, fileContent.nextIndex, fileContent.url);
        return fileContent;
    }
    
    getData = async () => {
        const startTime = Date.now();
        let content: Content = {complete: false, nextIndex: this.storage.nextIndex, url: this.storage.startURL, content: undefined, fromFile: false};
        while(!content.complete) {
            const orphanedDeletions: number[] = [];
            console.log(this.ctr++, content.url);
            const currentId = content.nextIndex;
            // this.log.logAction('fetching', 'url #' + this.ctr, content.url);
            content = await this.getNextContent(currentId, content.url);
            if (content.content) {
                const rootNode = Object.keys(content.content).find(n => n !== '?xml')!;
                if (content.content[rootNode]) {
                    let writables = content.content[rootNode]['schreibe'] as Array<any>;
                    let deletables = content.content[rootNode]['loesche'] as Array<any>;
                    if (writables) {
                        writables.forEach(entry => {
                            switch (Object.keys(entry)[0]) {
                                case 'leistung':
                                    this.storage.addLeistung(entry['leistung']);
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
                                    break;
                                default:
                                    this.log.logAction('ignore', 'write object handlers', Object.keys(entry)[0], 'failed');
                                    break;
                            }
                        });
                    }
                    if (deletables) {
                        if (typeof deletables.forEach !== 'function') {
                            deletables = [deletables as any];
                        }
                        deletables.forEach((entry, index) => {
                            const id = createID(entry.id);
                            switch(entry._klasse) {
                                case 'Zustaendigkeit':
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
                                    break;
                                default:
                                    this.log.logAction('ignore', 'delete object handlers', entry._klasse, 'failed');
                                    break;
                            }
                        });
                    }
                    if (orphanedDeletions.length > 0) {
                        orphanedDeletions.reverse().forEach(d => deletables.splice(d, 1));
                        this.storage.saveContent(content.content, currentId, content.nextIndex, content.url);
                    }
                }
            }
        }
        console.log(
            'Minuten:', Math.round((Date.now().valueOf() - startTime) / 6000) / 10,
        );
        this.storage.saveData(content.url, content.nextIndex);
        console.log('Minuten:', Math.round((Date.now().valueOf() - startTime) / 6000) / 10);
    }

    private sanitizeContent(content: any): boolean {
        const rootNode = Object.keys(content).find(n => n !== '?xml')!;
        if (!content[rootNode]) return false;
        const nodes = Object.keys(content[rootNode]).filter(n => !['schreibe', 'loesche', 'nachrichtenkopf', '_produktbezeichnung', '_produkthersteller', '_xzufiVersion'].includes(n));
        if (nodes.length > 0) {
            this.log.logAction('Extracting', 'unknown node types', nodes.join(', '), 'failed');
        }
        let schreibe = content[rootNode]['schreibe'];
        let changed = false;
        if (schreibe) {
            if (typeof schreibe.forEach !== 'function') {
                content[rootNode]['schreibe'] = [schreibe];
                schreibe = content[rootNode]['schreibe'];
                changed = true;
            }
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
                    // case 'onlinedienst':
                    //     break;
                    default:
                        break;
                }
            });
        }
        const loesche = content[rootNode]['loesche'];
        if (loesche) {
            if (typeof loesche.forEach !== 'function') {
                content[rootNode]['loesche'] = [loesche];
                changed = true;
            }
        }
        return changed;
    }

    private sanitizeLeistung(restLeistung: RestLeistung): boolean {
        let changed = false;
        if (restLeistung.struktur) {
            if (!restLeistung.struktur.verrichtungsdetail) {
                restLeistung.struktur.verrichtungsdetail = [];
                changed = true;
            } else if (typeof restLeistung.struktur.verrichtungsdetail !== 'function') {
                restLeistung.struktur.verrichtungsdetail = [restLeistung.struktur.verrichtungsdetail as any];
                changed = true;
            }
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
        if (!restLeistung.typisierung) {
            restLeistung.typisierung = [];
            changed = true;
            console.log('Fehlender Typ', restLeistung.id);
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
            restLeistung.modulBegriffImKontext = {
                begriffImKontext: []
            };
            changed = true;
        } else if (!restLeistung.modulBegriffImKontext.begriffImKontext) {
            restLeistung.modulBegriffImKontext.begriffImKontext = [];
            changed = true;
        } else if (typeof restLeistung.modulBegriffImKontext.begriffImKontext.map !== 'function') {
            restLeistung.modulBegriffImKontext.begriffImKontext = [restLeistung.modulBegriffImKontext.begriffImKontext as any];
            changed = true;
        }
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
        } else if (typeof restLeistung.modulUrsprungsportal !== 'function') {
            restLeistung.modulUrsprungsportal = [restLeistung.modulUrsprungsportal as any];
            changed = true;
        }
        return changed;
    }

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
            
}