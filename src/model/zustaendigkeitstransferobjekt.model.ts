import { createID } from './id.model';
import { RestZustaendigkeitTransferObjekt } from './rest/zustaendigkeit.model';

export interface Zustaendigkeit {
  id: string;
  mandant: string;
  uebergeordnetesObjektID: string,
  leistungID: string;
  zustaendigkeitsSchema: string;
  gebietId: string;
}

export const createZustaendigkeit = (zust: RestZustaendigkeitTransferObjekt): Zustaendigkeit => ({
  id: createID(zust.zustaendigkeit.id),
  mandant: zust.zustaendigkeit.id._schemeAgencyID,
  uebergeordnetesObjektID: createID(zust.uebergeordnetesObjektID),
  leistungID: createID(zust.zustaendigkeit.leistungID),
  zustaendigkeitsSchema: zust.zustaendigkeit.id._schemeID,
  gebietId: zust.zustaendigkeit.gebietID.text,
});

