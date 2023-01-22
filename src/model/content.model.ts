// Übergeordnetes Objekt, das im content property die XZuFi-Elemente enthält
export interface Content {
    url: string;
    nextIndex: number;
    complete: boolean;
    content: any;
    fromFile: boolean;
}
