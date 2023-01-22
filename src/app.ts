import { DataImport } from './controller/data-import.controller';

const dataImport = new DataImport();

// Synchronisationslauf durchführen
dataImport.getData().catch(reason => console.error(reason));

