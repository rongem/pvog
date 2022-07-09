import axios from 'axios';
import { XMLParser, X2jOptions} from "fast-xml-parser";
import { createID } from '../model/id.model';
import { Token } from '../model/token.model';
import { Logging } from './logging.controller';
import { Storage } from './storage.controller';

export class DataImport {
    private storage = new Storage();
    private authUrl = 'https://private.demo.pvog.dataport.de/auth/realms/pvog/protocol/openid-connect/token';
    private log = Logging.getInstance();
    private token!: Token;
    private ctr = 0;
    private options: Partial<X2jOptions> = {
        ignoreAttributes: false,
        attributeNamePrefix : "_",
        removeNSPrefix: true,
        textNodeName: 'text',
        numberParseOptions: {leadingZeros: true, hex: false, skipLike: /[0-9]+/}
    };
    
    getToken = async () => {
        const content = new URLSearchParams({
            'grant_type': 'client_credentials',
            'client_id': process.env.USER ?? '',
            'client_secret': process.env.PASSWORD ?? ''
        }).toString();
        const result = await axios.post(this.authUrl, content, {headers: {'Content-Type': 'application/x-www-form-urlencoded'}});
        return new Token(result.data['token_type'], result.data['access_token']);
    }
    
    getNextContent = async (url: string) => {
        if (!this.token || this.token.expired) {
            this.token = await this.getToken();
        }
        const result = await axios.get(url, {headers: {'Authorization': this.token.authorization}});
        // objCount += +result.data['anzahlObjekte'];
        let xmlContent = (result.data['xzufiObjekte'] as string);
        return {
            url: result.data['naechsteAnfrageUrl'] as string,
            nextIndex: result.data['naechsterIndex'] as number,
            complete: result.data['vollstaendig'] as boolean,
            xmlContent,
        };
    }
    
    getData = async () => {
        const startTime = Date.now();
        let content = {complete: false, nextIndex: 0, url: this.storage.startURL, xmlContent: ''};
        while(!content.complete) {
            console.log(this.ctr++, content.url);
            this.log.logAction('fetching', 'url #' + this.ctr, content.url);
            content = await this.getNextContent(content.url);
            const parser = new XMLParser(this.options);
            const xml = parser.parse(content.xmlContent);
            const rootNode = Object.keys(xml).find(n => n !== '?xml')!;
            const nodes = Object.keys(xml[rootNode]).filter(n =>
                !['schreibe', 'loesche', 'nachrichtenkopf', '_produktbezeichnung', '_produkthersteller', '_xzufiVersion'].includes(n));
            if (nodes.length > 0) {
                this.log.logAction('Extracting', 'unknown node types', nodes.join(', '), 'failed');
            }
            let contents = xml[rootNode]['schreibe'] as Array<any>;
            let deletable = xml[rootNode]['loesche'] as Array<any>;
            if (contents) {
                if (typeof contents.forEach !== 'function') {
                    contents = [contents as any];
                }
                contents.forEach(entry => {
                    switch (Object.keys(entry)[0]) {
                        case 'leistung':
                            this.storage.addLeistung(entry['leistung'])
                            break;
                        case 'organisationseinheit':
                            // this.storage.addOrganisationsEinheit(entry['organisationseinheit']);
                            break;
                        case 'zustaendigkeitTransferObjekt':
                            this.storage.addZustaendigkeit(entry[Object.keys(entry)[0]])
                            break;
                        case 'spezialisierung':
                            break;
                        case 'onlinedienst':
                            break;
                        default:
                            this.log.logAction('ignore', 'write object handlers', Object.keys(entry)[0], 'failed')
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
                            // this.storage.removeOrganisationseinheit(id);
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
            if (this.ctr > 0 && this.ctr %100 === 0) {
                this.storage.saveData(content.url);
            }
        }
        console.log(
            'Minuten:', Math.round((Date.now().valueOf() - startTime) / 6000) / 10,
        );
        this.storage.saveData(content.url);
        console.log('Minuten:', Math.round((Date.now().valueOf() - startTime) / 6000) / 10);
    }
            
}