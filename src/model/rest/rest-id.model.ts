// komplexe ID
// Text ist die interne ID
// Eindeutigkeit nur in Kombination mit der schemeAgencyId
export interface RestID {
    text: string,
    _schemeAgencyID: string;
    _schemeID: string;
}
