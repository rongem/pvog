import { CodeListEntry } from './code-list-entry.model';

export interface CodeList {
    [key: string]: CodeListEntry;
}