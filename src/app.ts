import { DataImport } from './controller/data-import.controller';

const dataImport = new DataImport();

dataImport.getData().catch(reason => console.error(reason));

