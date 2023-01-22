import { RestID } from './rest/rest-id.model'

// erzeugt eine eindeutige ID als string aus einer RestID
export const createID = (id: RestID) => id._schemeAgencyID + '_' + id.text; // '_' + id._schemeID + 
