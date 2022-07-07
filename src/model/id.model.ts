import { RestID } from './rest/rest-id.model'

export const createID = (id: RestID) => id._schemeAgencyID + '_' + id.text; // '_' + id._schemeID + 
