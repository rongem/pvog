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

// Kapseln aller Speicheroperationen. Die Speicherhaltung ist eine In-Memory-Datenbank, die je nach Bedarf
// in CSV bzw. JSON-Dateien persistiert wird. Beim Start werden die Dateien geladen, sofern die Datei nexturl.json
// im Verzeichnis gefunden wird. Wenn nicht, wird die Datenbank von Grund auf neu aufgebaut und die bestehenden
// Dateien ignoriert.
export class Storage {
    // Alle Leistungen. Für alle Datenobjekte gilt: die ID als Schlüssel wird zu einer Objekt-Eigenschaft, der Inhalt dann in
    // der Eigentschaft gespeichert. Das sichert bei weniger als 8,2 Millionen Einträgen die bestmögliche Performance
    private leistungen: {[key: string]: ILeistung} = {};
    // Alle Organisationseinheiten; derzeit irrelevant für SDG
    private organisationseinheiten: {[key: string]: Organisation} = {};
    // Alle Zuständigkeiten von Organisationen für Leistungen
    // Zweistufiges Objekt, das mandantenbezogen Daten ablegt. Das wurde notwendig, weil eine kritische Schwelle bei der Anzahl
    // der Schlüssel überschritten wurde und die Anwendung dadurch extrem verlangsamt wurde. Sollte ein einzelner Mandant diese
    // Schwelle ebenfalls überschreiten, muss eine andere Speicherform gefunden werden, was aber massive Performance-Einbussen 
    // bedeuten wird.
    private zustaendigkeiten: {[key: string]: {[key: string]: Zustaendigkeit}} = {};
    // Alle Zuständigkeiten von Leistungen für OnlineDienste; derzeit irrelevant für SDG
    private serviceZustaendigkeiten: {[key: string]: Zustaendigkeit} = {};
    // Alle OnlineDienste; derzeit irrelevant für SDG
    private services: {[key: string]: OnlineDienst} = {};
    // Leistungs-Textmodule; werden aufgrund der Größe separat gespeichert
    private texte: {[key: string]: IModultext[]} = {};
    // Liste der Dateinahmen
    private textModulesfile = '../pvog-data/textmodule.json';
    private nextUrlSave = '../pvog-data/nexturl.json';
    private leistungFile = '../pvog-data/leistungen.json';
    private oeFile = '../pvog-data/organisationseinheiten.json';
    private zustFile = '../pvog-data/zustaendigkeiten.csv';
    private servcieZustFile = '../pvog-data/service-zustaendigkeiten.csv';
    private serviceFile = '../pvog-data/online-dienste.json';
    private timestampFile = '../pvog-data/timestamp.txt';
    // Logging-Instanz
    private log = Logging.getInstance();
    // Sofern nicht in der Nexturl.json anders gespeichert, ist die StartURL leer
    public startURL = '';
    // Sofern nicht in der Nexturl.json anders gespeichert, ist nextIndex 0
    public nextIndex = 0;

    constructor() {
        // sofern die Datei nexturl.json gefunden wird, laden der vorhandenen Dateien, sonst ignorieren
        if (fs.existsSync(this.nextUrlSave)) {
            console.log('Reading files...');
            console.log(this.nextUrlSave);
            // Infos aus nexturl.json lesen
            const startInfo: {nextUrl: string, nextId: number} = JSON.parse(fs.readFileSync(this.nextUrlSave).toString());
            this.startURL = startInfo.nextUrl;
            this.nextIndex = startInfo.nextId;
            // Leistungen lesen und In-Memory-Datenbank damit füllen
            console.log(this.leistungFile);
            const la = JSON.parse(fs.readFileSync(this.leistungFile).toString()) as ILeistung[];
            la.forEach(l => this.leistungen[l.id] = l);
            // Modultexte lesen und In-Memory-Datenbank damit füllen
            console.log(this.textModulesfile);
            const texte = JSON.parse(fs.readFileSync(this.textModulesfile).toString()) as IModultext[];
            texte.forEach(t => {
                if (!this.texte[t.id]) {
                    this.texte[t.id] = [t];
                } else {
                    this.texte[t.id].push(t);
                }
            });
            // Organisationseinheiten lesen und In-Memory-Datenbank damit füllen
            console.log(this.oeFile);
            const oe = JSON.parse(fs.readFileSync(this.oeFile).toString()) as Organisation[];
            oe.forEach(o => this.organisationseinheiten[o.id] = o);
            // OnlineDienste lesen und In-Memory-Datenbank damit füllen
            console.log(this.serviceFile);
            const sv = JSON.parse(fs.readFileSync(this.serviceFile).toString()) as OnlineDienst[];
            sv.forEach(s => this.services[s.id] = s);
            // Zuständigkeiten von Organisationseinheit für Leistungen lesen und In-Memory-Datenbank damit füllen
            // Zweistufigkeit Mandant -> ID, weil 8,2 Millionen Einträge überschritten wurden und die Performance einbricht
            console.log(this.zustFile);
            let zuBuff = fs.readFileSync(this.zustFile);
            let delim = Buffer.from('\n');
            let zu = bsplit(zuBuff, delim);
            zu.map(z => z.toString()).forEach((z, i) => {
                if (i > 0 && z.trim() !== '') {
                    const values = z.split('\t');
                    const zust: Zustaendigkeit = {
                        id: values[0],
                        mandant: values[0].split('_')[0],
                        leistungID: values[1],
                        uebergeordnetesObjektID: values[2],
                        gebietId: values[3],
                        zustaendigkeitsSchema: 'ZustaendigkeitOrganisationseinheit',
                    };
                    this.storeZustaendigkeit(zust);
                }

            });
            // Zuständigkeit von Leistung für OnlineDienste lesen und In-Memory-Datenbank damit füllen
            console.log(this.servcieZustFile);
            zuBuff = fs.readFileSync(this.servcieZustFile);
            delim = Buffer.from('\n');
            zu = bsplit(zuBuff, delim);
            zu.map(z => z.toString()).forEach((z, i) => {
                if (i > 0 && z.trim() !== '') {
                    const values = z.split('\t');
                    const zust: Zustaendigkeit = {
                        id: values[0],
                        mandant: values[0].split('_')[0],
                        leistungID: values[1],
                        uebergeordnetesObjektID: values[2],
                        gebietId: values[3],
                        zustaendigkeitsSchema: 'ZustaendigkeitOnlinedienst',
                    };
                    this.serviceZustaendigkeiten[zust.id] = zust;
                }
            });
        } else {
            this.startURL = process.env.DATA_URL ?? 'error: missing DATA_URL env variable';
        }
    }
    
    // Prüfen, ob Mandant exsitiert und ggf. erzeugen. Dann Zuständigkeit zum Mandanten speichern
    private storeZustaendigkeit(zust: Zustaendigkeit) {
        if (!this.zustaendigkeiten[zust.mandant]) {
            this.zustaendigkeiten[zust.mandant] = {};
        }
        this.zustaendigkeiten[zust.mandant][zust.id] = zust;
    }

    // Speichern der In-Memory-Datenbank in einzelnen Dateien
    saveData = (nextUrl: string, nextId: number) => {
        console.log('saving files...');
        this.log.flushLog();
        try {
            console.log(this.timestampFile);
            fs.writeFileSync(this.timestampFile, new Date(Date.now()).toISOString());
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

    // Speichern eines bereinigten PVOG-XZuFi-Blocks im Cache
    saveContent = (content: any, index: number, nextIndex: number, url: string) => {
        const fileName = `../pvog-raw/${index}.json`;
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

    // Laden eines PVOG-XZuFi-Blocks aus dem Cache, soweit gefunden. Sonst wird null zurückgegeben
    loadContent = (index: number): Content | null => {
        const fileName = `../pvog-raw/${index}.json`;
        if (fs.existsSync(fileName)) {
            const contents = JSON.parse(fs.readFileSync(fileName).toString()) as Content;
            return contents;
        }
        return null;
    }

    // Speichern der Zuständigkeiten in einer Datei Mandant für Mandant
    private writeZustaendigkeiten() {
        // CSV-Kopfzeilen
        const headers = 'id\tleistungID\tuebergeordnetesObjektID\tgebietID\n';
        console.log(this.zustFile);
        // Mandanten ermitteln
        let keys = Object.keys(this.zustaendigkeiten);
        let content = headers;
        // Einzelne Durchläufe zählen
        let round = 0;
        for (let key of keys) {
            const mandant = this.zustaendigkeiten[key];
            // Alle Schlüssel des Mandanten lesen und einzeln speichern
            const mkeys = Object.keys(mandant);
            for (let mkey of mkeys) {
                const element = mandant[mkey];
                content += element.id + '\t' + element.leistungID + '\t' + element.uebergeordnetesObjektID + '\t' + element.gebietId + '\n';
            };
            console.log('Writing part', round, ': ', key);
            this.writeOrAppend(this.zustFile, content, round);
            round++;
            content = '';
        };
        // Für Zuständigkeiten für Onlinedienste die Datei in Einzelteilen speichern, um Speicherüberläufe zu vermeiden.
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

    // Prüfen, ob Datei existiert, und ggf. anhängen von Daten
    private writeOrAppend(fileName: string, content: string, part: number) {
        if (part === 0) {
            fs.writeFileSync(fileName, content);
        } else {
            fs.appendFileSync(fileName, content);
        }
    }

    // Leistungsobjekt der Datenbank hinzufügen
    addLeistung(restLeistung: RestLeistung) {
        // Umwandeln in ein Leistungsobjekt
        const leistung = createLeistung(restLeistung);
        // this.log.logAction(!!this.leistungen[leistung.id] ? 'update' : 'create', 'leistung', leistung.id)
        // Überprüfen, ob eine Leistungs bereits existiert, und vor der Aktualisierung die dynamischen Daten übernehmen
        const oldLeistung = this.leistungen[leistung.id];
        if (oldLeistung) {
            leistung.anzahlOEs = oldLeistung.anzahlOEs;
            leistung.anzahlServices = oldLeistung.anzahlServices;
            leistung.anzahlUpdates = oldLeistung.anzahlUpdates + 1;
        }
        // Leistung speichern / ersetzen
        this.leistungen[leistung.id] = leistung;
    }

    // Leistung und alle Textmodule dazu löschen
    removeLeistung(id: string) {
        if (this.leistungen[id]) {
            delete this.leistungen[id];
            this.removeText(id);
            this.log.logAction('delete', 'leistung', id);
        } else {
            this.log.logAction('delete', 'leistung', id, 'failed');
        }
    }

    // Organisationseinheit hinzufügen
    addOrganisationsEinheit(organisationseinheit: RestOrganisationsEinheit) {
        const oe = createOrganisation(organisationseinheit);
        // this.log.logAction(!!this.organisationseinheiten[oe.id] ? 'update' : 'create', 'organisationseinheit', oe.id)
        this.organisationseinheiten[oe.id] = oe;
    }

    // Organisationseinheit entfernen
    removeOrganisationseinheit(id: string) {
        if (this.organisationseinheiten[id]) {
            delete this.organisationseinheiten[id];
            this.log.logAction('delete', 'organisationseinheit ', id, 'failed');
        } else {
            this.log.logAction('delete', 'organisationseinheit', id, 'failed');
        }

    }
    
    // Zuständigkeit hinzufügen
    addZustaendigkeit(zustaendigkeit: RestZustaendigkeitTransferObjekt) {
        const zust = createZustaendigkeit(zustaendigkeit);
        if (!this.leistungen[zust.leistungID]) {
            this.log.logAction('add', zust.zustaendigkeitsSchema, zust.id, 'failed / missing leistung ' + zust.leistungID);
        } else {
            switch (zust.zustaendigkeitsSchema) {
                // Für Leistungen
                case 'ZustaendigkeitOrganisationseinheit':
                    // Sofern die Zuständigkeit nicht bereits existiert, Leistungsobjekt aktualsieren
                    if (!!this.zustaendigkeiten[zust.id]) {
                        // this.log.logAction('update', 'zustaendigkeit', zust.id)
                    } else {
                        // this.log.logAction('create', 'zustaendigkeit', zust.id)
                        this.leistungen[zust.leistungID].anzahlOEs++;
                    }
                    this.storeZustaendigkeit(zust);
                    break;
                // Für Onlinedienste
                case 'ZustaendigkeitOnlinedienst':
                    // Sofern die Zuständigkeit nicht bereits existiert, Service-Objekt und Leistungsobjekt aktualsieren
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
    
    // Zuständigkeit entfernen und betroffene Objekte aktualisieren
    removeZustaendigkeit(id: string) {
        const mandant = id.split('_')[0];
        if(!this.zustaendigkeiten[mandant]) {
            this.zustaendigkeiten[mandant] = {};
        }
        if (this.zustaendigkeiten[mandant][id]) {
            this.leistungen[this.zustaendigkeiten[mandant][id].leistungID].anzahlOEs--;
            delete this.zustaendigkeiten[mandant][id];
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

    // Textmodule einer Leistung hinzufügen
    addText(leistung: RestLeistung) {
        const text = createText(leistung);
        if (text.length > 0) {
            this.texte[text[0].id] = text;
        }
    }

    // Textmodule einer Leistung entfernen
    removeText(id: string) {
        delete this.texte[id];
    }

    // OnlineDienst hinzufügen bzw. aktualsiieren
    addService(dienst: RestOnlineDienst) {
        const service = createOnlineDienst(dienst);
        const oldService = this.services[service.id];
        // Sofern der Dienst aktualisiert wird, dynamisch erzeugte Eigenschaften aktualisieren
        if (!oldService) {
            // this.log.logAction('create', 'onlinedienst', service.id);
        } else {
            // this.log.logAction('update', 'onlinedienst', service.id);
            service.anzahlZustaendigkeiten = oldService.anzahlZustaendigkeiten;
        }
        this.services[service.id] = service;
    }

    // OnlineDienst entfernen
    removeService(id: string) {
        delete this.services[id];
    }

}
