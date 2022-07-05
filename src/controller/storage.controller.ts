import fs from 'fs';
import { CodeListEntry } from '../model/code-list-entry.model';
import { CodeList } from '../model/code-list.model';
import { createLeistung, ILeistung } from '../model/leistung.interface';
import { createOrganisation, Organisation } from '../model/organisation.model';
import { RestLeistung } from '../model/rest/leistung.model';
import { RestOrganisationsEinheit } from '../model/rest/organisationseinheit.model';
import { RestZustaendigkeitTransferObjekt } from '../model/rest/zustaendigkeit.model';
import { createZustaendigkeit, Zustaendigkeit } from '../model/zustaendigkeitstransferobjekt.model';
import { Logging } from './logging.controller';

export class Storage {
    private typisierungen: CodeList = {};
    private bundeslaender: CodeList = {};
    private typisierungChanged = false;
    private bundeslaenderChanged = false;
    private leistungen: {[key: string]: ILeistung} = {};
    private organisationseinheiten: {[key: string]: Organisation} = {};
    private zustaendigkeiten: {[key: string]: Zustaendigkeit} = {};
    private nextUrlSave = '../nexturl.txt';
    private leistungFile = '../leistungen.json';
    private oeFile = '../organisationseinheiten.json';
    private typFile = '../typisierungen.json';
    private bundeslandFile = '../bundeslaender.json';
    private zustFile = '../zustaendigkeiten.csv';
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
            console.log(this.bundeslandFile);
            const bl = JSON.parse(fs.readFileSync(this.bundeslandFile).toString()) as CodeListEntry[];
            bl.forEach(b => this.bundeslaender[b.code] = b);
            console.log(this.typFile);
            const ty = JSON.parse(fs.readFileSync(this.typFile).toString()) as CodeListEntry[];
            ty.forEach(t => this.typisierungen[t.code] = t);
            console.log(this.oeFile);
            const oe = JSON.parse(fs.readFileSync(this.oeFile).toString()) as Organisation[];
            oe.forEach(o => this.organisationseinheiten[o.id] = o);
            console.log(this.zustFile);
            const zu = fs.readFileSync(this.zustFile).toString().split('\n');
            zu.forEach((z, i) => {
                if (i > 0 && z.trim() !== '') {
                    const values = z.split('\t');
                    const zust: Zustaendigkeit = {
                        id: values[0],
                        leistungID: values[1],
                        uebergeordnetesObjektID: values[2],
                        zustaendigkeitsSchema: 'ZustaendigkeitOrganisationseinheit',
                    };
                    this.zustaendigkeiten[zust.id] = zust;
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
            if (this.typisierungChanged) {
                console.log(this.typFile);
                fs.writeFileSync(this.typFile, JSON.stringify(Object.values(this.typisierungen)));
                this.typisierungChanged = false;
            }
            if (this.bundeslaenderChanged) {
                console.log(this.bundeslandFile);
                fs.writeFileSync(this.bundeslandFile, JSON.stringify(Object.values(this.bundeslaender)));
                this.bundeslaenderChanged = false;
            }
            console.log(this.zustFile);
            const keys = Object.keys(this.zustaendigkeiten);
            let content = 'id\tleistungID\tuebergeordnetesObjektID\n';
            keys.forEach(key => {
                const element = this.zustaendigkeiten[key];
                content += element.id + '\t' + element.leistungID + '\t' + element.uebergeordnetesObjektID + '\n';
            });
            fs.writeFileSync(this.zustFile, content);
            console.log(this.nextUrlSave);
            fs.writeFileSync(this.nextUrlSave, nextUrl);
        } catch (error) {
            throw error;
        }
        console.log('done');
    }

    addLeistung(restLeistung: RestLeistung) {
        const leistung = createLeistung(restLeistung);
        if (!!this.leistungen[leistung.id]) {
            this.log.logAction('update', 'leistung', leistung.id);
        } else {
            this.log.logAction('create', 'leistung', leistung.id);
        }
        this.leistungen[leistung.id] = leistung;
        if (leistung.typisierung && !this.typisierungen[leistung.typisierung]) {
            this.typisierungChanged = true;
            this.typisierungen[leistung.typisierung] = {
                code: leistung.typisierung,
                name: restLeistung.typisierung.name
            };
        }
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
        oe.orte.forEach((o, i) => {
            if (o.bundesland && !this.bundeslaender[o.bundesland]) {
                this.bundeslaenderChanged = true;
                this.bundeslaender[o.bundesland] = {
                    code: o.bundesland,
                    name: organisationseinheit.anschrift[i].verwaltungspolitischeKodierung.bundesland.name
                };
            }
        });
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
        if (zust.zustaendigkeitsSchema === 'ZustaendigkeitOrganisationseinheit') {
            if (!this.leistungen[zust.leistungID]) {
                this.log.logAction('add', 'zustaendigkeit', zust.id, 'failed / missing leistung ' + zust.leistungID);
            } else if (!this.organisationseinheiten[zust.uebergeordnetesObjektID]) {
                this.log.logAction('add', 'zustaendigkeit', zust.id, 'failed / missing oe ' + zust.uebergeordnetesObjektID);
            } else {
                if (!!this.zustaendigkeiten[zust.id]) {
                    this.log.logAction('update', 'zustaendigkeit', zust.id)
                } else {
                    this.log.logAction('create', 'zustaendigkeit', zust.id)
                }
                this.zustaendigkeiten[zust.id] = zust;
            }
        } else {
            this.log.logAction('ignore', 'zustaendigkeit', zust.id + " as " + zust.zustaendigkeitsSchema);
        }
    }
    
    removeZustaendigkeit(id: string) {
        if (this.zustaendigkeiten[id]) {
            delete this.zustaendigkeiten[id];
            this.log.logAction('delete', 'zustaendigkeit', id);
        } else {
            this.log.logAction('delete', 'zustaendigkeit', id, 'failed');
        }
    }

    removeOrphanedZustaendigkeit() {
        console.log('Removing orphans');
        Object.keys(this.zustaendigkeiten).forEach(key => {
            if (!this.leistungen[this.zustaendigkeiten[key].leistungID]) {
                delete this.zustaendigkeiten[key];
                this.log.logAction('delete orpan / leistung', 'zustaendigkeit', key);
            }
            if (!this.organisationseinheiten[this.zustaendigkeiten[key].uebergeordnetesObjektID]) {
                delete this.zustaendigkeiten[key];
                this.log.logAction('delete orpan / organisationseinheit', 'zustaendigkeit', key);
            }
        });
        console.log('Finished removing Orphans');
    } 
}
