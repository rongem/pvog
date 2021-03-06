import fs from 'fs';
import bsplit from 'buffer-split';
import { createLeistung, ILeistung } from '../model/leistung.interface';
import { createOrganisation, Organisation } from '../model/organisation.model';
import { RestLeistung } from '../model/rest/leistung.model';
import { RestOrganisationsEinheit } from '../model/rest/organisationseinheit.model';
import { RestZustaendigkeitTransferObjekt } from '../model/rest/zustaendigkeit.model';
import { createZustaendigkeit, Zustaendigkeit } from '../model/zustaendigkeitstransferobjekt.model';
import { Logging } from './logging.controller';
import { Content } from '../model/content.model';
import { createText, IModultext } from '../model/modultext.interface';
import { createOnlineDienst, OnlineDienst } from '../model/online-dienst.interface';
import { RestOnlineDienst } from '../model/rest/online-dienst.model';

export class Storage {
    private leistungen: {[key: string]: ILeistung} = {};
    private organisationseinheiten: {[key: string]: Organisation} = {};
    private zustaendigkeiten: {[key: string]: Zustaendigkeit} = {};
    private serviceZustaendigkeiten: {[key: string]: Zustaendigkeit} = {};
    private services: {[key: string]: OnlineDienst} = {};
    private texte: {[key: string]: IModultext[]} = {};
    private textModulesfile = '../pvog-data/textmodule.json';
    private nextUrlSave = '../pvog-data/nexturl.json';
    private leistungFile = '../pvog-data/leistungen.json';
    private oeFile = '../pvog-data/organisationseinheiten.json';
    private zustFile = '../pvog-data/zustaendigkeiten.csv';
    private servcieZustFile = '../pvog-data/service-zustaendigkeiten.csv';
    private serviceFile = '../pvog-data/online-dienste.json';
    private log = Logging.getInstance();
    public startURL = '';
    public nextIndex = 0;
    private deletionsNW = 0;

    constructor() {
        if (fs.existsSync(this.nextUrlSave)) {
            console.log('Reading files...');
            console.log(this.nextUrlSave);
            const startInfo: {nextUrl: string, nextId: number} = JSON.parse(fs.readFileSync(this.nextUrlSave).toString());
            this.startURL = startInfo.nextUrl;
            this.nextIndex = startInfo.nextId;
            console.log(this.leistungFile);
            const la = JSON.parse(fs.readFileSync(this.leistungFile).toString()) as ILeistung[];
            la.forEach(l => this.leistungen[l.id] = l);
            console.log(this.textModulesfile);
            const texte = JSON.parse(fs.readFileSync(this.textModulesfile).toString()) as IModultext[];
            texte.forEach(t => {
                if (!this.texte[t.id]) {
                    this.texte[t.id] = [t];
                } else {
                    this.texte[t.id].push(t);
                }
            });
            console.log(this.oeFile);
            const oe = JSON.parse(fs.readFileSync(this.oeFile).toString()) as Organisation[];
            oe.forEach(o => this.organisationseinheiten[o.id] = o);
            console.log(this.serviceFile);
            const sv = JSON.parse(fs.readFileSync(this.serviceFile).toString()) as OnlineDienst[];
            sv.forEach(s => this.services[s.id] = s);
            console.log(this.zustFile);
            let zuBuff = fs.readFileSync(this.zustFile);
            let delim = Buffer.from('\n');
            let zu = bsplit(zuBuff, delim);
            zu.map(z => z.toString()).forEach((z, i) => {
                if (i > 0 && z.trim() !== '') {
                    const values = z.split('\t');
                    const zust: Zustaendigkeit = {
                        id: values[0],
                        leistungID: values[1],
                        uebergeordnetesObjektID: values[2],
                        gebietId: values[3],
                        zustaendigkeitsSchema: 'ZustaendigkeitOrganisationseinheit',
                    };
                    this.zustaendigkeiten[zust.id] = zust;
                }
            });
            console.log(this.servcieZustFile);
            zuBuff = fs.readFileSync(this.servcieZustFile);
            delim = Buffer.from('\n');
            zu = bsplit(zuBuff, delim);
            zu.map(z => z.toString()).forEach((z, i) => {
                if (i > 0 && z.trim() !== '') {
                    const values = z.split('\t');
                    const zust: Zustaendigkeit = {
                        id: values[0],
                        leistungID: values[1],
                        uebergeordnetesObjektID: values[2],
                        gebietId: values[3],
                        zustaendigkeitsSchema: 'ZustaendigkeitOnlinedienst',
                    };
                    this.serviceZustaendigkeiten[zust.id] = zust;
                }
            });
        } else {
            this.startURL = 'https://public.demo.pvog.dataport.de/bereitstelldienst/api/v2/verwaltungsobjekte?index=0&ars=%25'
        }
    }
        
    saveData = (nextUrl: string, nextId: number) => {
        console.log('deleted NW', this.deletionsNW);
        console.log('saving files...');
        this.log.flushLog();
        try {
            console.log(this.leistungFile);
            fs.writeFileSync(this.leistungFile, JSON.stringify(Object.values(this.leistungen)));
            console.log(this.textModulesfile);
            fs.writeFileSync(this.textModulesfile, JSON.stringify(Object.values(this.texte).flat()));
            console.log(this.oeFile);
            fs.writeFileSync(this.oeFile, JSON.stringify(Object.values(this.organisationseinheiten)));
            console.log(this.serviceFile);
            fs.writeFileSync(this.serviceFile, JSON.stringify(Object.values(this.services)));
            this.writeZustaendigkeiten();
            console.log(this.nextUrlSave);
            fs.writeFileSync(this.nextUrlSave, (JSON.stringify({nextId, nextUrl})));
        } catch (error) {
            throw error;
        }
        console.log('done');
    }

    saveContent = (content: any, index: number, nextIndex: number, url: string) => {
        const fileName = `../pvog-backup/${index}.json`;
        const rootNode = Object.keys(content).find(n => n !== '?xml')!;
        if (!content[rootNode]) return;
        fs.writeFileSync(fileName, JSON.stringify({
            content,
            complete: false,
            fromFile: true,
            nextIndex,
            url,
        }));
        console.log('saved', fileName);
    }

    loadContent = (index: number): Content | null => {
        const fileName = `../pvog-backup/${index}.json`;
        if (fs.existsSync(fileName)) {
            const contents = JSON.parse(fs.readFileSync(fileName).toString()) as Content;
            return contents;
        }
        return null;
    }

    private writeZustaendigkeiten() {
        const headers = 'id\tleistungID\tuebergeordnetesObjektID\tgebietID\n';
        console.log(this.zustFile);
        let keys = Object.keys(this.zustaendigkeiten);
        let content = headers;
        let round = 0;
        keys.forEach((key, i) => {
            const element = this.zustaendigkeiten[key];
            content += element.id + '\t' + element.leistungID + '\t' + element.uebergeordnetesObjektID + '\t' + element.gebietId + '\n';
            if (Math.trunc(i / 2000000) > round) {
                console.log('Writing part', round);
                this.writeOrAppend(this.zustFile, content, round);
                round++;
                content = '';
            }
        });
        this.writeOrAppend(this.zustFile, content, round);
        console.log(this.servcieZustFile);
        keys = Object.keys(this.serviceZustaendigkeiten);
        content = headers;
        round = 0;
        keys.forEach((key, i) => {
            const element = this.serviceZustaendigkeiten[key];
            content += element.id + '\t' + element.leistungID + '\t' + element.uebergeordnetesObjektID + '\t' + element.gebietId + '\n';
            if (Math.trunc(i / 2000000) > round) {
                console.log('Writing part', round);
                this.writeOrAppend(this.servcieZustFile, content, round);
                round++;
                content = '';
            }
        });
        this.writeOrAppend(this.servcieZustFile, content, round);
    }

    private writeOrAppend(fileName: string, content: string, part: number) {
        if (part === 0) {
            fs.writeFileSync(fileName, content);
        } else {
            fs.appendFileSync(fileName, content);
        }
    }

    addLeistung(restLeistung: RestLeistung) {
        const leistung = createLeistung(restLeistung);
        // this.log.logAction(!!this.leistungen[leistung.id] ? 'update' : 'create', 'leistung', leistung.id)
        const oldLeistung = this.leistungen[leistung.id];
        if (oldLeistung) {
            leistung.anzahlOEs = oldLeistung.anzahlOEs;
            leistung.anzahlServices = oldLeistung.anzahlServices;
            leistung.anzahlUpdates = oldLeistung.anzahlUpdates + 1;
        }
        this.leistungen[leistung.id] = leistung;
    }

    removeLeistung(id: string) {
        if (this.leistungen[id]) {
            delete this.leistungen[id];
            this.removeText(id);
            this.log.logAction('delete', 'leistung', id);
        } else {
            this.log.logAction('delete', 'leistung', id, 'failed');
        }
        if (id.startsWith('L100002_')) {
            this.deletionsNW++;
        }
    }

    addOrganisationsEinheit(organisationseinheit: RestOrganisationsEinheit) {
        const oe = createOrganisation(organisationseinheit);
        // this.log.logAction(!!this.organisationseinheiten[oe.id] ? 'update' : 'create', 'organisationseinheit', oe.id)
        this.organisationseinheiten[oe.id] = oe;
    }

    removeOrganisationseinheit(id: string) {
        if (this.organisationseinheiten[id]) {
            delete this.organisationseinheiten[id];
            this.log.logAction('delete', 'organisationseinheit ', id, 'failed');
        } else {
            this.log.logAction('delete', 'organisationseinheit', id, 'failed');
        }

    }
    
    addZustaendigkeit(zustaendigkeit: RestZustaendigkeitTransferObjekt) {
        const zust = createZustaendigkeit(zustaendigkeit);
        if (!this.leistungen[zust.leistungID]) {
            this.log.logAction('add', zust.zustaendigkeitsSchema, zust.id, 'failed / missing leistung ' + zust.leistungID);
        } else {
            switch (zust.zustaendigkeitsSchema) {
                case 'ZustaendigkeitOrganisationseinheit':
                    if (!!this.zustaendigkeiten[zust.id]) {
                        // this.log.logAction('update', 'zustaendigkeit', zust.id)
                    } else {
                        // this.log.logAction('create', 'zustaendigkeit', zust.id)
                        this.leistungen[zust.leistungID].anzahlOEs++;
                    }
                    this.zustaendigkeiten[zust.id] = zust;
                    break;
                case 'ZustaendigkeitOnlinedienst':
                    if (!!this.serviceZustaendigkeiten[zust.id]) {
                        // this.log.logAction('update', 'servicezustaendigkeit', zust.id)
                    } else {
                        // this.log.logAction('create', 'servicezustaendigkeit', zust.id)
                        this.leistungen[zust.leistungID].anzahlServices++;
                        if (this.services[zust.uebergeordnetesObjektID]) {
                            this.services[zust.uebergeordnetesObjektID].anzahlZustaendigkeiten++;
                        } else {
                            return;
                        }
                    }
                    this.serviceZustaendigkeiten[zust.id] = zust;
                    break;
                default:
                    this.log.logAction('ignore', 'zustaendigkeit', zust.id + " as " + zust.zustaendigkeitsSchema);
                    break;
            }
        }
    }
    
    removeZustaendigkeit(id: string) {
        if (this.zustaendigkeiten[id]) {
            this.leistungen[this.zustaendigkeiten[id].leistungID].anzahlOEs--;
            delete this.zustaendigkeiten[id];
            // this.log.logAction('delete', 'zustaendigkeit', id);
            return true;
        } else if (this.serviceZustaendigkeiten[id]) {
            this.leistungen[this.serviceZustaendigkeiten[id].leistungID].anzahlServices--;
            this.services[this.serviceZustaendigkeiten[id].uebergeordnetesObjektID].anzahlZustaendigkeiten--;
            delete this.serviceZustaendigkeiten[id];
            // this.log.logAction('delete', 'servicezustaendigkeit', id);
            return true;
        } else {
            this.log.logAction('delete', 'zustaendigkeit', id, 'failed');
            return false;
        }
    }

    addText(leistung: RestLeistung) {
        const text = createText(leistung);
        if (text.length > 0) {
            this.texte[text[0].id] = text;
        }
    }

    removeText(id: string) {
        delete this.texte[id];
    }

    addService(dienst: RestOnlineDienst) {
        const service = createOnlineDienst(dienst);
        const oldService = this.services[service.id];
        if (!oldService) {
            // this.log.logAction('create', 'onlinedienst', service.id);
        } else {
            // this.log.logAction('update', 'onlinedienst', service.id);
            service.anzahlZustaendigkeiten = oldService.anzahlZustaendigkeiten;
        }
        this.services[service.id] = service;
    }

    removeService(id: string) {
        delete this.services[id];
    }

}
