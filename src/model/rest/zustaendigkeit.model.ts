export interface RestZustaendigkeitTransferObjekt {
    uebergeordnetesObjektID: { text: string },
    zustaendigkeit: {
        id: {
          text: string,
          _schemeID: string
        },
        leistungID: { text: string },
        gebietID: { text: string },
        rolle: { code: string, name: string },
    },
}
