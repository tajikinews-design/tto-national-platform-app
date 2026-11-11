/** Presentation-only normalization of legacy issued numbers.
 * Original registry, history, revision IDs and cooperative scope remain unchanged.
 * Only remove the current verified workspace prefix at the left boundary.
 */
export function displayMemberNumber(slug:string,value:unknown):string|null{
 if(typeof value!=="string"||!value)return null;
 const legacyPrefix=slug+"-";
 return value.startsWith(legacyPrefix)?value.slice(legacyPrefix.length):value;
}
