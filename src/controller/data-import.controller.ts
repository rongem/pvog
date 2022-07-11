import axios from 'axios';
import { XMLParser, X2jOptions} from "fast-xml-parser";
import { Content } from '../model/content.model';
import { createID } from '../model/id.model';
import { RestLeistung } from '../model/rest/leistung.model';
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
        const fileContent = this.storage.loadContent(currentId);
        if (fileContent) {
            return fileContent;
        }
        if (!this.token || this.token.expired) {
            this.token = await this.getToken();
        }
        const result = await axios.get(url, {headers: {'Authorization': this.token.authorization}});
        let xmlContent = (result.data['xzufiObjekte'] as string);
        return {
            complete: result.data['vollstaendig'] as boolean,
            content: this.parser.parse(xmlContent),
            fromFile: false,
            nextIndex: result.data['naechsterIndex'] as number,
            url: result.data['naechsteAnfrageUrl'] as string,
        };
    }
    
    getData = async () => {
        const startTime = Date.now();
        let content: Content = {complete: false, nextIndex: 0, url: this.storage.startURL, content: undefined, fromFile: false};
        while(!content.complete) {
            console.log(this.ctr++, content.url);
            const currentId = content.nextIndex;
            this.log.logAction('fetching', 'url #' + this.ctr, content.url);
            content = await this.getNextContent(currentId, content.url);
            if (content.content) {
                const rootNode = Object.keys(content.content).find(n => n !== '?xml')!;
                const nodes = Object.keys(content.content[rootNode]).filter(n =>
                    !['schreibe', 'loesche', 'nachrichtenkopf', '_produktbezeichnung', '_produkthersteller', '_xzufiVersion'].includes(n));
                if (nodes.length > 0) {
                    this.log.logAction('Extracting', 'unknown node types', nodes.join(', '), 'failed');
                }
                let contents = content.content[rootNode]['schreibe'] as Array<any>;
                let deletable = content.content[rootNode]['loesche'] as Array<any>;
                if (contents) {
                    if (typeof contents.forEach !== 'function') {
                        contents = [contents as any];
                    }
                    contents.forEach(entry => {
                        switch (Object.keys(entry)[0]) {
                            case 'leistung':
                                this.sanitizeLeistung(entry['leistung']);
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
                if (deletable) {
                    if (typeof deletable.forEach !== 'function') {
                        deletable = [deletable as any];
                    }
                    deletable.forEach(entry => {
                        const id = createID(entry.id);
                        switch(entry._klasse) {
                            case 'Zustaendigkeit':
                                this.storage.removeZustaendigkeit(id);
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
                if (!content.fromFile) {
                    this.storage.saveContent(contents, currentId, content.nextIndex, content.url);
                }
                if (this.ctr > 0 && this.ctr %100 === 0) {
                    this.storage.saveData(content.url);
                }
            }
        }
        console.log(
            'Minuten:', Math.round((Date.now().valueOf() - startTime) / 6000) / 10,
        );
        this.storage.saveData(content.url);
        console.log('Minuten:', Math.round((Date.now().valueOf() - startTime) / 6000) / 10);
    }

    private sanitizeLeistung(restLeistung: RestLeistung) {
        if (restLeistung.struktur) {
            if (!restLeistung.struktur.verrichtungsdetail) {
                restLeistung.struktur.verrichtungsdetail = [];
            } else if (typeof restLeistung.struktur.verrichtungsdetail !== 'function') {
                restLeistung.struktur.verrichtungsdetail = [restLeistung.struktur.verrichtungsdetail as any];
            }
        }
        if (restLeistung.kategorie) {
            if (!restLeistung.kategorie.bezeichnung) {
                restLeistung.kategorie.bezeichnung = [];
            } else if (typeof restLeistung.kategorie.bezeichnung.map !== 'function') {
                restLeistung.kategorie.bezeichnung = [restLeistung.kategorie.bezeichnung as any];
            }
            if (!restLeistung.kategorie.beschreibung) {
                restLeistung.kategorie.beschreibung = [];
            } else if (typeof restLeistung.kategorie.beschreibung.map !== 'function') {
                restLeistung.kategorie.beschreibung = [restLeistung.kategorie.beschreibung as any];
            }
        }
        if (!restLeistung.modulText) {
            restLeistung.modulText = [];
        } else if (typeof restLeistung.modulText !== 'function') {
            restLeistung.modulText = [restLeistung.modulText as any];
        }
        restLeistung.modulText.forEach(text => {
            if (!text.inhalt) {
                text.inhalt = [];
            } else if (typeof text.inhalt.map !== 'function') {
                text.inhalt = [text.inhalt as any];
            }
        });
        if (!restLeistung.sprachversion) {
            restLeistung.sprachversion = [];
        } else if (typeof restLeistung.sprachversion.map !== 'function') {
            restLeistung.sprachversion = [restLeistung.sprachversion as any];
        }
        if (!restLeistung.modulBearbeitungsdauer) {
            restLeistung.modulBearbeitungsdauer = {
                beschreibung: []
            };
        } else if (!restLeistung.modulBearbeitungsdauer.beschreibung) {
            restLeistung.modulBearbeitungsdauer.beschreibung = [];
        } else if (typeof restLeistung.modulBearbeitungsdauer.beschreibung.map !== 'function') {
            restLeistung.modulBearbeitungsdauer.beschreibung = [restLeistung.modulBearbeitungsdauer.beschreibung as any];
        }
        if (!restLeistung.modulBegriffImKontext) {
            restLeistung.modulBegriffImKontext = {
                begriffImKontext: []
            };
        } else if (!restLeistung.modulBegriffImKontext.begriffImKontext) {
            restLeistung.modulBegriffImKontext.begriffImKontext = [];
        } else if (typeof restLeistung.modulBegriffImKontext.begriffImKontext.map !== 'function') {
            restLeistung.modulBegriffImKontext.begriffImKontext = [restLeistung.modulBegriffImKontext.begriffImKontext as any];
        }
        if (restLeistung.modulFachlicheFreigabe) {
            if (!restLeistung.modulFachlicheFreigabe.fachlichFreigegebenDurch) {
                restLeistung.modulFachlicheFreigabe.fachlichFreigegebenDurch = [];
            } else if (typeof restLeistung.modulFachlicheFreigabe.fachlichFreigegebenDurch.map !== 'function') {
                restLeistung.modulFachlicheFreigabe.fachlichFreigegebenDurch = [restLeistung.modulFachlicheFreigabe.fachlichFreigegebenDurch as any];
            }
        }
        if (!restLeistung.modulFrist) {
            restLeistung.modulFrist = {
                beschreibung: []
            };
        } else if (!restLeistung.modulFrist.beschreibung) {
            restLeistung.modulFrist.beschreibung = [];
        } else if (typeof restLeistung.modulFrist.beschreibung.map !== 'function') {
            restLeistung.modulFrist.beschreibung = [restLeistung.modulFrist.beschreibung as any];
        }
        if (!restLeistung.modulKosten) {
            restLeistung.modulKosten = {
                beschreibung: []
            };
        } else if (!restLeistung.modulKosten.beschreibung) {
            restLeistung.modulKosten.beschreibung = [];
        } else if (typeof restLeistung.modulKosten.beschreibung.map !== 'function') {
            restLeistung.modulKosten.beschreibung = [restLeistung.modulKosten.beschreibung as any];
        }
        if (!restLeistung.modulBearbeitungsdauer) {
            restLeistung.modulBearbeitungsdauer = {
                beschreibung: []
            };
        } else if (!restLeistung.modulBearbeitungsdauer.beschreibung) {
            restLeistung.modulBearbeitungsdauer.beschreibung = [];
        } else if (typeof restLeistung.modulBearbeitungsdauer.beschreibung.map !== 'function') {
            restLeistung.modulBearbeitungsdauer.beschreibung = [restLeistung.modulBearbeitungsdauer.beschreibung as any];
        }
        if (!restLeistung.modulUrsprungsportal) {
            restLeistung.modulUrsprungsportal = [];
        } else if (typeof restLeistung.modulUrsprungsportal !== 'function') {
            restLeistung.modulUrsprungsportal = [restLeistung.modulUrsprungsportal as any];
        }
    }
            
}