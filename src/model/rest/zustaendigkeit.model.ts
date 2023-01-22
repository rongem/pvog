import { RestID } from './rest-id.model';

// XZuFI-Zuständigkeit: Zuordnung einer Leistung zu einer Gebietskörperschaft und zu einer OE, einem Service oder einem Formular
export interface RestZustaendigkeitTransferObjekt {
    uebergeordnetesObjektID: RestID;
    zustaendigkeit: {
        id: RestID;
        leistungID: RestID;
        gebietID: { text: string };
        rolle: { code: string; name: string };
    };
}
