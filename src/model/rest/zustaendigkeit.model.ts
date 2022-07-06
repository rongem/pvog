import { RestID } from './rest-id.model';

export interface RestZustaendigkeitTransferObjekt {
    uebergeordnetesObjektID: RestID;
    zustaendigkeit: {
        id: RestID;
        leistungID: RestID;
        gebietID: { text: string };
        rolle: { code: string; name: string };
    };
}
