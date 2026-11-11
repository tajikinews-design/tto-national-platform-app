/**
 * CHILD-07 / Share Market v3: read-only, non-authoritative register parity candidate.
 *
 * NOT an official register importer. Never trusts values supplied by the browser
 * and never emits a transfer/approval command. Inputs are snapshots from separately
 * sourced, authenticated backends in a future integration; no such integration or
 * formal custodian approval is currently available. Synthetic CI uses test-only data.
 */
export type RegisterReconciliationStatus =
  | "MATCHED_CANDIDATE_ONLY" | "BLOCKED";

export interface RegisterPosition {
  readonly tenantId: string;
  readonly accountId: string;
  readonly quantity: bigint | null;
  readonly sourceEntryRef: string | null;
}

export interface OfficialRegisterCandidateSnapshot {
  readonly tenantId: string;
  readonly registerId: string | null;
  readonly custodianSourceRef: string | null;
  readonly sourceVersion: number | null;
  readonly asOf: string | null;
  readonly issuedShares: bigint | null;
  readonly treasuryShares: bigint | null;
  readonly positions: readonly RegisterPosition[];
}

export interface Child07ReadProjectionSnapshot {
  readonly tenantId: string;
  readonly registerSourceVersion: number | null;
  readonly issuedShares: bigint | null;
  readonly treasuryShares: bigint | null;
  readonly positions: readonly RegisterPosition[];
}

export interface OfficialRegisterReconciliationReview {
  readonly status: RegisterReconciliationStatus;
  readonly blockers: readonly string[];
  readonly checkedAccounts: number;
  readonly officialSourceAccepted: false;
  readonly legalOwnershipTransferAuthorized: false;
  readonly candidateCanBePromoted: false;
  readonly sourceAuthority: "EXTERNAL_COOPERATIVE_OFFICIAL_REGISTER";
}

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isQty(v: unknown): v is bigint {
  return typeof v==="bigint" && v>=0n;
}
function isRef(v: unknown): v is string {
  return typeof v==="string" && v.trim().length>=8 && v.trim().length<=256;
}
function isTimestamp(value: unknown): value is string {
  return typeof value==="string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,19)===value.slice(0,19);
}

/** Comparison only. A complete synthetic match is NOT authenticity or legal signoff. */
export function reviewOfficialRegisterReconciliation(
  official: OfficialRegisterCandidateSnapshot | null | undefined,
  projection: Child07ReadProjectionSnapshot | null | undefined
): OfficialRegisterReconciliationReview {
  const blockers: string[]=[];
  const fail=(code:string):void=>{if(!blockers.includes(code))blockers.push(code);};
  if(!official||!projection){
    return {status:"BLOCKED",blockers:["REGISTER_OR_PROJECTION_MISSING"],
      checkedAccounts:0,officialSourceAccepted:false,
      legalOwnershipTransferAuthorized:false,candidateCanBePromoted:false,
      sourceAuthority:"EXTERNAL_COOPERATIVE_OFFICIAL_REGISTER"};
  }
  if(!UUID.test(official.tenantId)||!UUID.test(projection.tenantId)||
     official.tenantId!==projection.tenantId)fail("TENANT_SOURCE_MISMATCH");
  if(!isRef(official.registerId)||!isRef(official.custodianSourceRef))
    fail("OFFICIAL_CUSTODIAN_SOURCE_UNVERIFIED");
  if(!Number.isSafeInteger(official.sourceVersion)||official.sourceVersion===null||
     official.sourceVersion<1 ||
     !Number.isSafeInteger(projection.registerSourceVersion)||
     projection.registerSourceVersion===null||projection.registerSourceVersion<1)
    fail("REGISTER_SOURCE_VERSION_MISSING");
  else if(official.sourceVersion!==projection.registerSourceVersion)
    fail("REGISTER_SOURCE_VERSION_MISMATCH");
  if(!isTimestamp(official.asOf))fail("REGISTER_AS_OF_INVALID");
  if(!isQty(official.issuedShares)||!isQty(official.treasuryShares)||
     official.treasuryShares>official.issuedShares)
    fail("OFFICIAL_CAPITAL_TOTAL_INVALID");
  if(!isQty(projection.issuedShares)||!isQty(projection.treasuryShares)||
     projection.treasuryShares>projection.issuedShares)
    fail("PROJECTION_CAPITAL_TOTAL_INVALID");
  if(isQty(official.issuedShares)&&isQty(projection.issuedShares)&&
     official.issuedShares!==projection.issuedShares)fail("ISSUED_SHARE_TOTAL_MISMATCH");
  if(isQty(official.treasuryShares)&&isQty(projection.treasuryShares)&&
     official.treasuryShares!==projection.treasuryShares)fail("TREASURY_SHARE_TOTAL_MISMATCH");

  function mapPositions(entries:readonly RegisterPosition[],kind:"REGISTER"|"PROJECTION"):
    {map:Map<string,bigint>,sum:bigint} {
    const map=new Map<string,bigint>();let sum=0n;
    if(!Array.isArray(entries)){fail(kind+"_ENTRIES_MISSING");return {map,sum};}
    for(const entry of entries){
      if(!entry||!UUID.test(entry.tenantId)||entry.tenantId!==official!.tenantId||
         !UUID.test(entry.accountId)){fail(kind+"_TENANT_OR_ACCOUNT_INVALID");continue;}
      if(map.has(entry.accountId)){fail(kind+"_DUPLICATE_ACCOUNT");continue;}
      if(!isQty(entry.quantity)){fail(kind+"_UNKNOWN_QUANTITY");continue;}
      if(!isRef(entry.sourceEntryRef)) {fail(kind+"_SOURCE_REFERENCE_MISSING");continue;}
      map.set(entry.accountId,entry.quantity);sum+=entry.quantity;
    }
    return {map,sum};
  }
  const a=mapPositions(official.positions,"REGISTER");
  const b=mapPositions(projection.positions,"PROJECTION");
  const allAccounts=new Set([...a.map.keys(),...b.map.keys()]);
  for(const account of allAccounts){
    if(!a.map.has(account)||!b.map.has(account))
      fail("ACCOUNT_MISSING_FROM_SOURCE_OR_PROJECTION");
    else if(a.map.get(account)!==b.map.get(account))
      fail("ACCOUNT_SHARE_QUANTITY_MISMATCH");
  }
  if(isQty(official.issuedShares)&&isQty(official.treasuryShares)&&
     a.sum+official.treasuryShares!==official.issuedShares)
    fail("REGISTER_CONSERVATION_MISMATCH");
  if(isQty(projection.issuedShares)&&isQty(projection.treasuryShares)&&
     b.sum+projection.treasuryShares!==projection.issuedShares)
    fail("PROJECTION_CONSERVATION_MISMATCH");
  return {
    status:blockers.length?"BLOCKED":"MATCHED_CANDIDATE_ONLY",blockers,
    checkedAccounts:allAccounts.size,officialSourceAccepted:false,
    legalOwnershipTransferAuthorized:false,candidateCanBePromoted:false,
    sourceAuthority:"EXTERNAL_COOPERATIVE_OFFICIAL_REGISTER"
  };
}
