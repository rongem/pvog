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

export class Storage {
    private leistungen: {[key: string]: ILeistung} = {};
    private organisationseinheiten: {[key: string]: Organisation} = {};
    private zustaendigkeiten: {[key: string]: Zustaendigkeit} = {};
    private serviceZustaendigkeiten: {[key: string]: Zustaendigkeit} = {};
    private nextUrlSave = '../nexturl.txt';
    private leistungFile = '../leistungen.json';
    private oeFile = '../organisationseinheiten.json';
    private zustFile = '../zustaendigkeiten.csv';
    private servcieZustFile = '../service-zustaendigkeiten.csv';
    private log = Logging.getInstance();
    public startURL = '';

    constructor() {
        if (fs.existsSync(this.nextUrlSave)) {
            console.log('Reading files...');
            console.log(this.nextUrlSave);
            this.startURL = fs.readFileSync(this.nextUrlSave).toString();
            console.log(this.leistungFile);
            const la = JSON.parse(fs.readFileSync(this.leistungFile).toString()) as ILeistung[];
            la.forEach(l => this.leistungen[l.id] = l);
            console.log(this.oeFile);
            const oe = JSON.parse(fs.readFileSync(this.oeFile).toString()) as Organisation[];
            oe.forEach(o => this.organisationseinheiten[o.id] = o);
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
        
    saveData = (nextUrl: string) => {
        console.log('saving files...');
        fs.appendFileSync('../log.txt', this.log.logLines);
        this.log.clearLog();
        try {
            console.log(this.leistungFile);
            fs.writeFileSync(this.leistungFile, JSON.stringify(Object.values(this.leistungen)));
            console.log(this.oeFile);
            fs.writeFileSync(this.oeFile, JSON.stringify(Object.values(this.organisationseinheiten)));
            this.writeZustaendigkeiten();
            console.log(this.nextUrlSave);
            fs.writeFileSync(this.nextUrlSave, nextUrl);
        } catch (error) {
            throw error;
        }
        console.log('done');
    }

    saveContent = (content: any, index: number, nextIndex: number, url: string) => {
        const fileName = `../pvog-backup/${index}.json`;
        fs.writeFile(fileName, JSON.stringify({
            content,
            complete: false,
            fromFile: true,
            nextIndex,
            url,
        }), () => console.log('Saved', fileName));
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
        if (!!this.leistungen[leistung.id]) {
            this.log.logAction('update', 'leistung', leistung.id);
        } else {
            this.log.logAction('create', 'leistung', leistung.id);
        }
        this.leistungen[leistung.id] = leistung;
    }

    removeLeistung(id: string) {
        if (this.leistungen[id]) {
            delete this.leistungen[id];
            this.log.logAction('delete', 'leistung', id);
        } else {
            this.log.logAction('delete', 'leistung', id, 'failed');
        }

    }

    addOrganisationsEinheit(organisationseinheit: RestOrganisationsEinheit) {
        const oe = createOrganisation(organisationseinheit);
        if (!!this.organisationseinheiten[oe.id]) {
            this.log.logAction('update', 'organisationseinheit', oe.id);
        } else {
            this.log.logAction('create', 'organisationseinheit', oe.id);
        }
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
                        this.log.logAction('update', 'zustaendigkeit', zust.id)
                    } else {
                        this.log.logAction('create', 'zustaendigkeit', zust.id)
                        this.leistungen[zust.leistungID].anzahlOEs++;
                    }
                    this.zustaendigkeiten[zust.id] = zust;
                    break;
                case 'ZustaendigkeitOnlinedienst':
                    if (!!this.serviceZustaendigkeiten[zust.id]) {
                        this.log.logAction('update', 'servicezustaendigkeit', zust.id)
                    } else {
                        this.log.logAction('create', 'servicezustaendigkeit', zust.id)
                        this.leistungen[zust.leistungID].anzahlServices++;
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
            this.log.logAction('delete', 'zustaendigkeit', id);
        } else if (this.serviceZustaendigkeiten[id]) {
            this.leistungen[this.serviceZustaendigkeiten[id].leistungID].anzahlServices--;
            delete this.serviceZustaendigkeiten[id];
            this.log.logAction('delete', 'servicezustaendigkeit', id);
        } else {
            this.log.logAction('delete', 'zustaendigkeit', id, 'failed');
        }
    }

}
