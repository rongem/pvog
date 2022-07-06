import { RestZustaendigkeitTransferObjekt } from './rest/zustaendigkeit.model';

export interface Zustaendigkeit {
  id: string;
  uebergeordnetesObjektID: string,
  leistungID: string;
  zustaendigkeitsSchema: string;
  gebietId: string;
}

export const createZustaendigkeit = (zust: RestZustaendigkeitTransferObjekt): Zustaendigkeit => ({
  id: zust.zustaendigkeit.id.text,
  uebergeordnetesObjektID: zust.uebergeordnetesObjektID.text,
  leistungID: zust.zustaendigkeit.leistungID.text,
  zustaendigkeitsSchema: zust.zustaendigkeit.id._schemeID,
  gebietId: zust.zustaendigkeit.gebietID.text,
});

