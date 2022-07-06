import { RestID } from './rest/rest-id.model'

export const createID = (id: RestID) => id._schemeAgencyID + '_' + id._schemeID + '_' + id.text;
