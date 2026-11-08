/**
 * CHILD-06 point-in-time *source-declared* governance projection.
 * Two distinct clocks: effective Jalali date and database known-at timestamp.
 * An absent publication date, legal identity attestation or unresolved conflict
 * NEVER yields legally verified signer/board rights.
 */
type R=Record<string,unknown>;
const date=/^14[0-9]{2}\/(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])$/;
function validDate(s:unknown):s is string {
 if(typeof s!=="string"||!date.test(s))return false;
 const month=Number(s.slice(5,7)),day=Number(s.slice(8,10));
 return day<=(month<=6?31:month<12?30:30);
}
function arr(v:unknown,name:string,limit:number):R[]{
 if(!Array.isArray(v)||v.length>limit||
    v.some(x=>!x||typeof x!=="object"||Array.isArray(x)))
  throw new Error("CHILD06_TEMPORAL_INVALID_"+name);
 return v as R[];
}
const string=(v:unknown)=>typeof v==="string"?v:"";
const nullable=(v:unknown)=>typeof v==="string"?v:null;
export function reconstructGovernanceSnapshot(
 source:unknown,asOf:string,knownAt:string
):Record<string,unknown> {
 if(!validDate(asOf)||!Number.isFinite(Date.parse(knownAt)))
  throw new Error("CHILD06_TEMPORAL_INVALID_DATE");
 if(!source||typeof source!=="object"||Array.isArray(source))
  throw new Error("CHILD06_TEMPORAL_SOURCE_UNAVAILABLE");
 const s=source as R;
 if(s.officiallyVerified!==false||s.legalSignerAuthorityGranted!==false||
    s.tariffActivated!==false||typeof s.tenantId!=="string"||
    s.knownAt!==knownAt)
  throw new Error("CHILD06_TEMPORAL_SOURCE_NOT_FAIL_CLOSED");
 const notices=arr(s.notices,"NOTICES",200);
 const board=arr(s.board,"BOARD",2500);
 const signing=arr(s.signing,"SIGNING",400);
 const transitions=arr(s.transitions,"TRANSITIONS",500);
 const byId=new Map<string,R>();
 for(const n of notices){
  const id=string(n.noticeId);
  if(!id||byId.has(id)||!validDate(n.resolutionOn)||
     !["COMPANY_REGISTRY","OFFICIAL_GAZETTE"].includes(string(n.sourceType))||
     n.provenance!=="USER_SUPPLIED_SOURCE_NOT_AUTHENTICATED"||
     (n.publishedOn!==null&&!validDate(n.publishedOn))||
     typeof n.submittedAt!=="string"||Date.parse(n.submittedAt)>Date.parse(knownAt))
   throw new Error("CHILD06_TEMPORAL_INVALID_NOTICE");
  byId.set(id,n);
 }
 const issues:string[]=[];
 const conflicts:string[]=[];
 const replacements=new Set<string>();
 const activeTransitions=new Map<string,R[]>();
 for(const t of transitions){
  const target=string(t.targetNoticeId),replacement=nullable(t.replacementNoticeId);
  if(!byId.has(target)||!validDate(t.effectiveOn)||
     !["CORRECTED","REVOKED"].includes(string(t.action))||
     typeof t.recordedAt!=="string"||Date.parse(t.recordedAt)>Date.parse(knownAt)||
     t.sourceStatus!=="USER_SUPPLIED_SOURCE_NOT_AUTHENTICATED"||
     (replacement!==null&&!byId.has(replacement))||
     (t.action==="CORRECTED")!==(replacement!==null)||
     (t.publishedOn!==null&&!validDate(t.publishedOn)))
    throw new Error("CHILD06_TEMPORAL_INVALID_TRANSITION");
  if(replacement)replacements.add(replacement);
  if(string(t.effectiveOn)>asOf)continue;
  if(t.publishedOn===null){
   issues.push("TRANSITION_PUBLICATION_UNKNOWN:"+string(t.transitionId));
   continue;
  }
  if(string(t.publishedOn)>asOf)continue;
  const list=activeTransitions.get(target)??[];
  list.push(t);activeTransitions.set(target,list);
 }
 const discarded=new Set<string>();
 for(const [target,events] of activeTransitions){
  discarded.add(target);
  if(events.length>1){
   conflicts.push("CONFLICTING_NOTICE_TRANSITIONS:"+target);
   for(const e of events)if(e.replacementNoticeId)discarded.add(string(e.replacementNoticeId));
  }
 }
 const visible=new Map<string,R>();
 for(const [id,n] of byId){
  if(discarded.has(id))continue;
  const isReplacement=replacements.has(id);
  const activated=[...activeTransitions.values()].some(list=>list.length===1&&
     list[0].replacementNoticeId===id);
  if(isReplacement&&!activated)continue;
  if(string(n.resolutionOn)>asOf)continue;
  if(n.publishedOn!==null&&string(n.publishedOn)>asOf)continue;
  if(n.publishedOn===null)issues.push("NOTICE_PUBLICATION_UNKNOWN:"+id);
  visible.set(id,n);
 }
 const grouped=new Map<string,R[]>();
 for(const b of board){
  const id=string(b.noticeId);
  if(!byId.has(id)||!validDate(b.eventOn)||
     (b.termEnd!==null&&!validDate(b.termEnd))||
     !["APPOINTED","REAPPOINTED","REPORTED","RESIGNED","REMOVED"].includes(string(b.eventType))||
     !string(b.personName)||!string(b.office))
    throw new Error("CHILD06_TEMPORAL_INVALID_BOARD_EVENT");
  if(!visible.has(id)||string(b.eventOn)>asOf)continue;
  const key=string(b.personName)+"::"+string(b.office);
  const items=grouped.get(key)??[];items.push(b);grouped.set(key,items);
 }
 const candidateOffices:R[]=[],endedOffices:R[]=[];
 for(const [key,events] of grouped){
  events.sort((a,b)=>string(b.eventOn).localeCompare(string(a.eventOn)));
  const head=events[0],same=events.filter(x=>x.eventOn===head.eventOn);
  const distinct=new Set(same.map(e=>string(e.eventType)+"|"+string(e.noticeId)));
  if(distinct.size>1){
   conflicts.push("AMBIGUOUS_SAME_DAY_OFFICE:"+key);
   continue;
  }
  const item={personName:head.personName,office:head.office,eventType:head.eventType,
    effectiveOn:head.eventOn,termEnd:head.termEnd,noticeId:head.noticeId,
    publicationKnown:visible.get(string(head.noticeId))?.publishedOn!==null,
    legallyVerified:false};
  if(["RESIGNED","REMOVED"].includes(string(head.eventType))||
      (typeof head.termEnd==="string"&&head.termEnd<asOf)){
   endedOffices.push({...item,endReason:["RESIGNED","REMOVED"].includes(string(head.eventType))?
      head.eventType:"TERM_END_PASSED"});
  }else candidateOffices.push({...item,
     temporalStatus:item.publicationKnown?"DECLARED_NOT_LEGALLY_VERIFIED":
       "DECLARED_PUBLICATION_DATE_UNKNOWN"});
 }
 for(const office of ["CEO","BOARD_CHAIR","BOARD_VICE_CHAIR","BOARD_SECRETARY"]){
  if(candidateOffices.filter(e=>e.office===office).length>1)
   conflicts.push("MULTIPLE_CLAIMANTS:"+office);
 }
 const signingCandidates:R[]=[];
 for(const r of signing){
  const id=string(r.noticeId);
  if(!byId.has(id)||!validDate(r.effectiveFrom)||
      (r.statedEnd!==null&&!validDate(r.statedEnd))||
      !["BINDING_FINANCIAL","ORDINARY_LETTERS"].includes(string(r.authorityKind))||
      typeof r.requiredSigner!=="string"||!Array.isArray(r.alternateSigners))
   throw new Error("CHILD06_TEMPORAL_INVALID_SIGNING_EVENT");
  if(!visible.has(id)||string(r.effectiveFrom)>asOf||
      (typeof r.statedEnd==="string"&&r.statedEnd<asOf))continue;
  const known=visible.get(id)?.publishedOn!==null;
  signingCandidates.push({...r,legallyVerified:false,
    temporalStatus:known?"DECLARED_NOT_LEGALLY_VERIFIED":
     "DECLARED_PUBLICATION_DATE_UNKNOWN"});
 }
 for(const kind of ["BINDING_FINANCIAL","ORDINARY_LETTERS"]){
  if(signingCandidates.filter(r=>r.authorityKind===kind).length>1)
   conflicts.push("OVERLAPPING_SIGNING_RULES:"+kind);
 }
 if(!notices.length)issues.push("NO_REGISTERED_NOTICE");
 if(!candidateOffices.length)issues.push("NO_RECONSTRUCTABLE_BOARD_AT_DATE");
 if(!signingCandidates.length)issues.push("NO_RECONSTRUCTABLE_SIGNING_RULE_AT_DATE");
 const certainty=conflicts.length?"CONFLICT_HOLD":
   issues.length?"INCOMPLETE_SOURCE_HOLD":"SOURCE_DECLARED_ONLY";
 return {tenantId:s.tenantId,asOf,knownAt,certainty,
  officialSourceAuthenticated:false,legalSignerAuthorityGranted:false,
  boardLegallyApproved:false,tariffActivated:false,
  candidateOffices,endedOffices,signingCandidates,
  issues:[...new Set(issues)].sort(),conflicts:[...new Set(conflicts)].sort(),
  consideredNoticeIds:[...visible.keys()].sort(),immutableEventCount:{
    notices:notices.length,board:board.length,signing:signing.length,
    transitions:transitions.length}};
}
