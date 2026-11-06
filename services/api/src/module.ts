import { Module, Global, Controller, Get, Headers, Param, ParseUUIDPipe, Injectable, UnauthorizedException, ForbiddenException, Post, Body, BadRequestException, ServiceUnavailableException, ConflictException, HttpCode, Req } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { ApiIrSmsOtpProvider } from "./apiir-provider";
import { scanQuarantineBytes } from "./clamd-evidence";

@Injectable()
export class Database {
  private readonly pool: Pool;
  constructor() {
    // Preview-only: construct the connection server-side so its password never
    // appears in GitHub or in a non-secret URL environment variable.
    // The Supabase pooler hostname MUST be copied from this project's Connect
    // dialog: region-based hostname guessing can target another pooler.
    let connectionString = process.env.DATABASE_URL;
    let tls: { rejectUnauthorized: true; ca: string } | undefined;
    if (!connectionString && process.env.VERCEL) {
      const host = process.env.TTO_DB_POOLER_HOST ?? "";
      const password = process.env.TTO_DB_APP_PASSWORD ?? "";
      const projectRef = process.env.TTO_DB_PROJECT_REF ?? "";
      const rootCA = process.env.TTO_DB_CA_PEM ?? "";
      if (!/^[a-z0-9-]+\.pooler\.supabase\.com$/.test(host) ||
          projectRef !== "zkfwsgrgslxxlusxrwce" || password.length < 60 ||
          !rootCA.startsWith("-----BEGIN CERTIFICATE-----") ||
          !rootCA.trimEnd().endsWith("-----END CERTIFICATE-----")) {
        throw new Error("TTO_PREVIEW_DATABASE_CONFIGURATION_INCOMPLETE");
      }
      connectionString = "postgresql://" +
        encodeURIComponent("tto_app." + projectRef) + ":" +
        encodeURIComponent(password) + "@" + host + ":6543/postgres";
      tls = { rejectUnauthorized: true, ca: rootCA };
    }
    if (!connectionString) throw new Error("DATABASE_URL_NOT_CONFIGURED");
    this.pool = new Pool({
      connectionString,
      ...(tls ? {ssl:tls} : {}),
      max: process.env.VERCEL ? 1 : 8,
      connectionTimeoutMillis: process.env.VERCEL ? 3800 : 10000,
      idleTimeoutMillis: 10000,
      application_name: "tto_api"
    });
  }
  async onModuleInit(): Promise<void> {
    const result = await this.pool.query<{rolsuper:boolean;rolbypassrls:boolean;rolname:string}>(
      "SELECT rolsuper, rolbypassrls, rolname FROM pg_roles WHERE rolname = current_user"
    );
    if (result.rows.length !== 1 || result.rows[0].rolsuper ||
        result.rows[0].rolbypassrls || result.rows[0].rolname !== "tto_app") {
      throw new Error("RLS_SAFE_DATABASE_ROLE_REQUIRED");
    }
  }
  async onModuleDestroy(): Promise<void> { await this.pool.end(); }
  async workspaceExists(slug:string):Promise<boolean>{
    const result=await this.pool.query(
      "SELECT 1 FROM tto.cooperative_workspace_addresses WHERE slug=$1 AND state='RESERVED' LIMIT 1",
      [slug]
    );
    return (result.rowCount??0)>0;
  }
  async isReady(): Promise<void> { await this.pool.query("SELECT 1 FROM tto.tenants LIMIT 0"); }
  async prepareSmsLogin(mobile:string, id:string, hash:Buffer):Promise<boolean>{
    const r=await this.pool.query<{ok:boolean}>(
      "SELECT tto.begin_smsotp_login($1,$2,$3,clock_timestamp()+interval '4 minutes') AS ok",
      [mobile,id,hash]
    );
    return r.rows[0]?.ok===true;
  }
  async reservePublicOtpRequest(ipKey:Buffer,mobileKey:Buffer):Promise<boolean>{
    const result=await this.pool.query<{ok:boolean}>(
      "SELECT tto.reserve_public_otp_request($1,$2) AS ok",[ipKey,mobileKey]
    );
    return result.rows[0]?.ok===true;
  }
  async attestSmsDelivery(id:string, accepted:boolean):Promise<boolean>{
    const r=await this.pool.query<{ok:boolean}>(
      "SELECT tto.complete_smsotp_delivery($1,$2) AS ok",[id,accepted]
    );
    return r.rows[0]?.ok===true;
  }
  async reserveNationalRootAttempt(key:Buffer):Promise<boolean>{
    const result=await this.pool.query<{allowed:boolean}>(
      "SELECT tto.reserve_national_root_attempt($1) AS allowed",[key]);
    return result.rows[0]?.allowed===true;
  }
  async nationalRootCredentialState():Promise<{
    username:string|null;password_scrypt:string|null;must_change_credentials:boolean;credentials_version:string
  }|null>{
    const r=await this.pool.query<{
      username:string|null;password_scrypt:string|null;must_change_credentials:boolean;credentials_version:string
    }>("SELECT username,password_scrypt,must_change_credentials,credentials_version FROM tto.national_root_credential_state()");
    return r.rows[0]??null;
  }
  async issueNationalRootSession(hash:Buffer,version:string):Promise<boolean>{
    const result=await this.pool.query<{issued:boolean}>(
      "SELECT tto.issue_national_root_session($1,$2::bigint) AS issued",[hash,version]);
    return result.rows[0]?.issued===true;
  }
  async beginMobileRegistration(mobile:string,id:string,hash:Buffer):Promise<boolean>{
    const r=await this.pool.query<{ok:boolean}>(
      "SELECT tto.begin_mobile_registration($1,$2,$3,clock_timestamp()+interval '4 minutes') AS ok",
      [mobile,id,hash]
    );
    return r.rows[0]?.ok===true;
  }
  async consumeMobileRegistration(challengeId:string,verifier:Buffer,sessionHash:Buffer):Promise<boolean>{
    const r=await this.pool.query<{user_id:string|null}>(
      "SELECT tto.consume_mobile_registration($1,$2,$3) AS user_id",
      [challengeId,verifier,sessionHash]
    );
    return typeof r.rows[0]?.user_id==="string";
  }
  async consumeChallenge(challengeId:string, verifier:Buffer, sessionHash:Buffer): Promise<boolean> {
    const result=await this.pool.query<{user_id:string|null}>(
      "SELECT tto.consume_challenge($1,$2,$3) AS user_id",[challengeId,verifier,sessionHash]);
    return !!result.rows[0]?.user_id;
  }
  async withActor<T>(actor:string,task:(client:PoolClient)=>Promise<T>):Promise<T> {
    const client=await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('tto.actor_id',$1,true)",[actor]);
      const result=await task(client);
      await client.query("COMMIT");
      return result;
    } catch(e) {try {await client.query("ROLLBACK")}catch{};throw e}
    finally {client.release()}
  }
  sessionDigest(authorization?:string):Buffer {
    const match=/^Bearer ([A-Za-z0-9_-]{32,256})$/.exec(authorization ?? "");
    if(!match)throw new UnauthorizedException("Authentication required");
    return createHash("sha256").update(match[1]).digest();
  }
  async sessionActor(authorization?: string): Promise<string> {
    const hash=this.sessionDigest(authorization);
    const result=await this.pool.query<{user_id:string}>(
      "SELECT user_id FROM tto.resolve_session($1)",[hash]);
    if(result.rows.length!==1)throw new UnauthorizedException("Invalid or expired session");
    return result.rows[0].user_id;
  }
  async inTenant<T>(userId:string, tenantId:string, work:(client:PoolClient)=>Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('tto.actor_id',$1,true),set_config('tto.tenant_id',$2,true)", [userId,tenantId]);
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch(e) {
      try { await client.query("ROLLBACK"); } catch { /* release connection */ }
      throw e;
    } finally { client.release(); }
  }
}
@Global()
@Module({ providers: [Database], exports: [Database] })
export class DatabaseModule {}

@Injectable()
export class IdentityService {
  constructor(private readonly db: Database) {}
  requireActor(auth?:string): Promise<string> { return this.db.sessionActor(auth); }
}
@Module({ providers:[IdentityService], exports:[IdentityService] })
export class IdentityModule {}

@Injectable()
export class TenantPartyService {
  constructor(private readonly db: Database, private readonly identity: IdentityService) {}
  async getContext(tenantId:string, authorization?:string) {
    const actor = await this.identity.requireActor(authorization);
    return this.db.inTenant(actor,tenantId,async client=>{
      const result = await client.query<{tenant_id:string;slug:string;status:string}>(
        "SELECT tenant_id,slug,status FROM tto.tenants WHERE tenant_id=$1",[tenantId]
      );
      if (!result.rowCount) throw new ForbiddenException({code:"CROSS_TENANT_ACCESS_DENIED",message:"Tenant scope inaccessible"});
      return result.rows[0];
    });
  }
}
@Controller("v1/tenants")
export class TenantController {
  constructor(private readonly tenants:TenantPartyService) {}
  @Get(":tenantId/context")
  context(@Param("tenantId",new ParseUUIDPipe()) id:string,@Headers("authorization") auth?:string) {
    return this.tenants.getContext(id,auth);
  }
}
@Module({imports:[IdentityModule],controllers:[TenantController],providers:[TenantPartyService]})
export class TenantPartyModule {}

@Injectable()
export class DocumentsService {
  constructor(private readonly db: Database, private readonly identity:IdentityService) {}
  async list(tenantId:string,authorization?:string) {
    const actor=await this.identity.requireActor(authorization);
    return this.db.inTenant(actor,tenantId,async client=>{
      const valid=await client.query("SELECT tenant_id FROM tto.tenants WHERE tenant_id=$1",[tenantId]);
      if(!valid.rowCount) throw new ForbiddenException({code:"CROSS_TENANT_ACCESS_DENIED",message:"Tenant scope inaccessible"});
      const documents=await client.query(
        "SELECT document_id,title,classification,status,created_at FROM tto.documents WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 50",[tenantId]
      );
      return {items:documents.rows};
    });
  }
}
@Controller("v1/tenants")
export class DocumentsController {
  constructor(private readonly docs:DocumentsService) {}
  @Get(":tenantId/documents")
  list(@Param("tenantId",new ParseUUIDPipe()) id:string,@Headers("authorization") auth?:string) {
    return this.docs.list(id,auth);
  }
}
@Module({imports:[IdentityModule],controllers:[DocumentsController],providers:[DocumentsService]})
export class DocumentsAuditModule {}
@Controller()
export class HealthController {
  constructor(private readonly db:Database) {}
  @Get("health") status() { return {status:"ok",stage:"CF01-03_FOUNDATION",note:"Not proof of database/tenant health"}; }
  @Get("ready") async ready() {
    try { await this.db.isReady(); return {status:"ready",database:"reachable"}; }
    catch { throw new ServiceUnavailableException("Service not ready"); }
  }
}

/** Tenant commands are routed only through verified session -> transaction-local identity context. */
function verifyNationalPassword(password:string,encoded:string):boolean{
  const parts=encoded.split("$");
  if(parts.length!==4||parts[0]!=="scrypt"||parts[1]!=="v1"||
     !/^[a-f0-9]{32}$/.test(parts[2])||!/^[a-f0-9]{128}$/.test(parts[3]))
    throw new ServiceUnavailableException("NATIONAL_CREDENTIAL_HASH_INVALID");
  const actual=scryptSync(password,Buffer.from(parts[2],"hex"),64,
    {N:16384,r:8,p:1,maxmem:64*1024*1024});
  return timingSafeEqual(actual,Buffer.from(parts[3],"hex"));
}
const uuidPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
function requireId(value:unknown):string {
  if(typeof value!=="string" || !uuidPattern.test(value))throw new BadRequestException("Invalid identifier");
  return value;
}
function requireText(value:unknown, minimum:number, maximum:number):string {
  if(typeof value!=="string" || value.trim().length<minimum || value.length>maximum)
    throw new BadRequestException("Invalid field");
  return value.trim();
}
@Controller("v1")
export class FoundationCommandsController {
  constructor(private readonly db:Database, private readonly sms:ApiIrSmsOtpProvider){}
  private async run<T>(tenant:string,auth:string|undefined,sql:string,values:unknown[]):Promise<T>{
    const actor=await this.db.sessionActor(auth);
    return this.db.inTenant(actor,tenant,async c=>{
      const data=await c.query<{out:T}>(sql,values);
      return data.rows[0].out;
    });
  }

  @Get("national/cooperative-workspaces/:slug")
  async findWorkspace(@Param("slug") slug:string){
    if(!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug))
      throw new BadRequestException("INVALID_WORKSPACE_SLUG");
    // Return only public routing identifiers, never identity, owner or company data.
    return this.db.workspaceExists(slug).then(exists=>({exists,slug}));
  }

  @Post("national/cooperative-workspaces")
  @HttpCode(201)
  async reserveCooperativeWorkspace(@Headers("authorization") auth:string|undefined,
    @Body() input:Record<string,unknown>){
    // This is an address reservation, NOT legal registration, Tenant activation or role grant.
    if(process.env.TTO_ISOLATED_DEMO_DB!=="true")
      throw new ServiceUnavailableException("ISOLATED_DEMO_DATABASE_REQUIRED");
    const slug=typeof input?.slug==="string"?input.slug:"";
    if(!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)||
       new Set(["admin","login","api","auth","demo","national","shareholder","manager","system","www"]).has(slug))
      throw new BadRequestException("INVALID_WORKSPACE_SLUG");
    const actor=await this.db.sessionActor(auth);
    return this.db.withActor(actor,async client=>{
      const role=await client.query<{allowed:boolean}>(
        'SELECT tto.has_platform_operator() AS allowed'
      );
      if(role.rows[0]?.allowed!==true)
        throw new ForbiddenException("NATIONAL_PLATFORM_OPERATOR_REQUIRED");
      const workspaceId=randomUUID();
      try{
       await client.query(
        "INSERT INTO tto.cooperative_workspace_addresses(workspace_id,slug,created_by) VALUES ($1,$2,$3)",
        [workspaceId,slug,actor]);
      }catch(e){
       if((e as {code?:string}).code==="23505")
        throw new ConflictException("WORKSPACE_ADDRESS_TAKEN");
       throw e;
      }
      return {workspaceId,slug,address:"https://www.ttoir.ir/c/"+slug,
       state:"RESERVED",managementAccessGranted:false};
    });
  }

  // Protected national-root only. A submitted dossier is NEVER a created tenant.
  @Get("national/cooperative-onboarding")
  async listNationalCooperativeOnboarding(@Headers("authorization") auth:string|undefined){
    if(process.env.TTO_ISOLATED_DEMO_DB!=="true")
      throw new ServiceUnavailableException("ONBOARDING_PREVIEW_ONLY");
    const actor=await this.db.sessionActor(auth);
    return this.db.withActor(actor,async client=>{
      const role=await client.query<{allowed:boolean}>("SELECT tto.has_national_root() AS allowed");
      if(role.rows[0]?.allowed!==true)throw new ForbiddenException("NATIONAL_ROOT_REQUIRED");
      const r=await client.query<{
        slug:string;workspace_state:string;dossier_id:string|null;dossier_state:string|null;
        legal_name:string|null;candidate_manager_name:string|null;submitted_at:string|null;review_version:number|null
      }>(
       "SELECT w.slug,w.state AS workspace_state,d.dossier_id,d.state AS dossier_state, "+
       "d.legal_name,d.candidate_manager_name,d.submitted_at,d.review_version "+
       "FROM tto.cooperative_workspace_addresses w "+
       "LEFT JOIN tto.cooperative_onboarding_dossiers d ON d.workspace_id=w.workspace_id "+
       "WHERE w.state='RESERVED' ORDER BY w.created_at DESC LIMIT 100"
      );
      return {items:r.rows,tenantActivated:false};
    });
  }

  @Post("national/cooperative-onboarding")
  @HttpCode(201)
  async submitNationalCooperativeOnboarding(
    @Headers("authorization") auth:string|undefined,@Body() input:Record<string,unknown>
  ){
    if(process.env.TTO_ISOLATED_DEMO_DB!=="true")
      throw new ServiceUnavailableException("ONBOARDING_PREVIEW_ONLY");
    const slug=requireText(input?.slug,3,40);
    if(!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug))
      throw new BadRequestException("INVALID_WORKSPACE_SLUG");
    const legalName=requireText(input?.legalName,8,180);
    const nationalId=requireText(input?.nationalId,11,11);
    const registrationNumber=requireText(input?.registrationNumber,1,20);
    const province=requireText(input?.province,2,120);
    const county=requireText(input?.county,2,120);
    const legalAddress=requireText(input?.legalAddress,8,300);
    const representativeName=requireText(input?.representativeName,3,120);
    const candidateManagerName=requireText(input?.candidateManagerName,3,120);
    const candidateManagerMobile=requireText(input?.candidateManagerMobile,11,11);
    const evidenceReference=input?.evidenceReference===undefined||input?.evidenceReference===""
      ?null:requireText(input?.evidenceReference,5,180);
    if(!/^[0-9]{11}$/.test(nationalId)||!/^[0-9]{1,20}$/.test(registrationNumber)||
       !/^09[0-9]{9}$/.test(candidateManagerMobile))
      throw new BadRequestException("INVALID_LEGAL_IDENTIFIERS_OR_MOBILE");
    const actor=await this.db.sessionActor(auth);
    return this.db.withActor(actor,async client=>{
      const role=await client.query<{allowed:boolean}>("SELECT tto.has_national_root() AS allowed");
      if(role.rows[0]?.allowed!==true)throw new ForbiddenException("NATIONAL_ROOT_REQUIRED");
      // Shared transaction lock with save_cooperative_onboarding_draft prevents
      // saving a new draft after concurrent dossier submission commits.
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,42))",[slug]);
      const reserved=await client.query<{workspace_id:string}>(
        "SELECT workspace_id FROM tto.cooperative_workspace_addresses "+
        "WHERE slug=$1 AND state='RESERVED'",[slug]);
      if(reserved.rowCount!==1)
        throw new BadRequestException("WORKSPACE_MUST_BE_RESERVED");
      const existingTenant=await client.query(
        "SELECT 1 FROM tto.tenants WHERE slug=$1 LIMIT 1",[slug]);
      if(existingTenant.rowCount)throw new ConflictException("WORKSPACE_ALREADY_PROVISIONED");
      const id=randomUUID();
      try{
        await client.query(
          "INSERT INTO tto.cooperative_onboarding_dossiers "+
          "(dossier_id,workspace_id,legal_name,national_id,registration_number,"+
          "province,county,legal_address,representative_name,candidate_manager_name,"+
          "candidate_manager_mobile,evidence_reference,created_by) "+
          "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
          [id,reserved.rows[0].workspace_id,legalName,nationalId,registrationNumber,
            province,county,legalAddress,representativeName,candidateManagerName,
            candidateManagerMobile,evidenceReference,actor]
        );
        await client.query(
          "INSERT INTO tto.cooperative_onboarding_audit(dossier_id,actor_id,action) "+
          "VALUES ($1,$2,'DOSSIER_SUBMITTED')",[id,actor]);
      }catch(e){
        if((e as {code?:string}).code==="23505")
          throw new ConflictException("DOSSIER_ALREADY_EXISTS");
        throw e;
      }
      return {dossierId:id,slug,status:"PENDING_LEGAL_REVIEW",tenantCreated:false,
        managerRoleGranted:false,managerMobileVerified:false};
    });
  }

  // PH10.4: isolated pre-tenant encrypted quarantine. No file is made readable.
  @Post("national/cooperative-onboarding-evidence")
  @HttpCode(201)
  async uploadQuarantinedCooperativeEvidence(
    @Headers("authorization") auth:string|undefined,@Body() input:Record<string,unknown>
  ){
    if(process.env.TTO_ISOLATED_DEMO_DB!=="true")
      throw new ServiceUnavailableException("ONBOARDING_PREVIEW_ONLY");
    const key=process.env.TTO_COOP_QUARANTINE_KEY_HEX??"";
    if(!/^[a-fA-F0-9]{64}$/.test(key))
      throw new ServiceUnavailableException("QUARANTINE_ENCRYPTION_NOT_CONFIGURED");
    const slug=requireText(input?.slug,3,40);
    if(!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug))
      throw new BadRequestException("INVALID_WORKSPACE_SLUG");
    const uploadKey=requireId(input?.uploadKey);
    const contentBase64=input?.contentBase64;
    const mime=input?.mimeType;
    if(typeof mime!=="string"||!["application/pdf","image/png","image/jpeg"].includes(mime)||
      typeof contentBase64!=="string"||contentBase64.length>700000||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(contentBase64))
      throw new BadRequestException("INVALID_EVIDENCE_ENCODING_OR_MIME");
    const plain=Buffer.from(contentBase64,"base64");
    if(plain.length<8||plain.length>524288||plain.toString("base64")!==contentBase64)
      throw new BadRequestException("INVALID_EVIDENCE_SIZE");
    const isPdf=plain.subarray(0,5).equals(Buffer.from("%PDF-"));
    const isPng=plain.subarray(0,8).equals(Buffer.from("89504e470d0a1a0a","hex"));
    const isJpeg=plain[0]===0xff&&plain[1]===0xd8&&plain[2]===0xff;
    if((mime==="application/pdf"&&!isPdf)||(mime==="image/png"&&!isPng)||
       (mime==="image/jpeg"&&!isJpeg))
      throw new BadRequestException("EVIDENCE_SIGNATURE_MISMATCH");
    const filename="document."+(isPdf?"pdf":isPng?"png":"jpg");
    const sha=createHash("sha256").update(plain).digest();
    const iv=randomBytes(12);
    const cipher=createCipheriv("aes-256-gcm",Buffer.from(key,"hex"),iv);
    const encrypted=Buffer.concat([cipher.update(plain),cipher.final()]);
    const tag=cipher.getAuthTag();
    // Never log document bytes, hashes, key material, or transport body.
    const actor=await this.db.sessionActor(auth);
    return this.db.withActor(actor,async client=>{
      try{
        const result=await client.query<{out:Record<string,unknown>}>(
          "SELECT tto.store_quarantined_cooperative_evidence($1::text,$2::uuid,$3::text,"+
          "$4::text,$5::bytea,$6::bytea,$7::bytea,$8::bytea) AS out",
          [slug,uploadKey,filename,mime,sha,iv,tag,encrypted]
        );
        return result.rows[0].out;
      }catch(e){
        const code=(e as {code?:string}).code;
        if(code==="42501")throw new ForbiddenException("QUARANTINE_ACCESS_DENIED");
        if(code==="23505")throw new ConflictException("QUARANTINE_UPLOAD_CONFLICT");
        if(code==="22023")throw new BadRequestException("INVALID_QUARANTINE_DOCUMENT");
        throw e;
      }
    });
  }

  // PH10.8 manager-only, session-bound historical self-report read. No approval.
  @Get("tenants/:tenantId/governance/manual-official-notices")
  async listManualOfficialGovernanceNotices(
    @Param("tenantId",new ParseUUIDPipe()) tenantId:string,
    @Headers("authorization") auth:string|undefined
  ){
    if(process.env.TTO_ISOLATED_DEMO_DB!=="true")
      throw new ServiceUnavailableException("MANUAL_GAZETTE_REGISTRY_NOT_RELEASED");
    const actor=await this.db.sessionActor(auth);
    return this.db.inTenant(actor,tenantId,async client=>{
      try{
        const result=await client.query<{out:Record<string,unknown>}>(
          "SELECT tto.list_manual_official_governance_claims($1::uuid,$2::bytea) AS out",
          [tenantId,this.db.sessionDigest(auth)]);
        const value=result.rows[0]?.out;
        if(!value||value.selfReportedOnly!==true||value.officiallyVerified!==false||
           value.legalApproval!==false||value.roleGranted!==false||
           !Array.isArray(value.items))
          throw new ServiceUnavailableException("GAZETTE_HISTORY_UNAVAILABLE");
        return {tenantId,...value};
      }catch(e){
        if((e as {code?:string}).code==="42501")
          throw new ForbiddenException("MANAGER_LEGAL_AUTHORITY_REQUIRED");
        throw e;
      }
    });
  }

  @Post("tenants/:tenantId/governance/manual-official-notices")
  @HttpCode(201)
  async reportManualOfficialGovernanceNotice(
    @Param("tenantId",new ParseUUIDPipe()) tenantId:string,
    @Headers("authorization") auth:string|undefined,
    @Body() input:Record<string,unknown>
  ){
    // Only existing activated tenants with independently authorized managers.
    // Explicitly disabled for any non-isolated runtime until legal release review.
    if(process.env.TTO_ISOLATED_DEMO_DB!=="true")
      throw new ServiceUnavailableException("MANUAL_GAZETTE_REGISTRY_NOT_RELEASED");
    if(!input||typeof input!=="object"||Array.isArray(input))
      throw new BadRequestException("INVALID_GAZETTE_CLAIM");
    const requestKey=requireId(input.requestKey);
    const personName=requireText(input.personFullName,3,160);
    const officeType=String(input.officeType??"");
    const signingMode=String(input.signingMode??"");
    const authorityScope=requireText(input.authorityScope,10,1500);
    const gazetteIssue=String(input.gazetteIssueNumber??"");
    const gazetteDate=String(input.gazettePublicationDate??"");
    const gazetteNotice=String(input.gazetteAnnouncementNumber??"");
    const from=typeof input.effectiveFrom==="string"?input.effectiveFrom:null;
    const until=typeof input.effectiveUntil==="string"?input.effectiveUntil:null;
    const url=typeof input.officialReferenceUrl==="string"?input.officialReferenceUrl:null;
    const supersedes=typeof input.supersedesClaimId==="string"?requireId(input.supersedesClaimId):null;
    if(!["BOARD_CHAIR","BOARD_VICE_CHAIR","BOARD_MEMBER","CEO","AUTHORIZED_SIGNATORY","INSPECTOR","OTHER"].includes(officeType)||
       !["NONE","INDIVIDUAL","JOINT","BOARD_RESOLUTION","OTHER_SPECIFIED"].includes(signingMode)||
       !/^[0-9]{1,20}$/.test(gazetteIssue)||
       !/^[0-9A-Za-z-]{1,40}$/.test(gazetteNotice)||
       !/^\d{4}-\d{2}-\d{2}$/.test(gazetteDate)||
       (from!==null&&!/^\d{4}-\d{2}-\d{2}$/.test(from))||
       (until!==null&&!/^\d{4}-\d{2}-\d{2}$/.test(until))||
       (url!==null&&(!url.startsWith("https://")||url.length>400)))
      throw new BadRequestException("INVALID_OFFICIAL_GAZETTE_CITATION");
    const actor=await this.db.sessionActor(auth);
    return this.db.inTenant(actor,tenantId,async client=>{
      try{
        const result=await client.query<{out:Record<string,unknown>}>(
         "SELECT tto.submit_manual_official_governance_claim("+
         "$1::uuid,$2::uuid,$3::text,$4::text,$5::text,$6::text,"+
         "$7::text,$8::date,$9::text,$10::date,$11::date,$12::text,"+
         "$13::uuid,$14::bytea) AS out",
         [tenantId,requestKey,personName,officeType,signingMode,authorityScope,
          gazetteIssue,gazetteDate,gazetteNotice,from,until,url,supersedes,
          this.db.sessionDigest(auth)]);
        return {tenantId,...result.rows[0].out};
      }catch(e){
        const code=(e as {code?:string}).code;
        if(code==="42501")throw new ForbiddenException("MANAGER_LEGAL_AUTHORITY_REQUIRED");
        if(code==="23505")throw new ConflictException("GAZETTE_REQUEST_KEY_CONFLICT");
        if(["22023","22007","22008","23514"].includes(code??""))
          throw new BadRequestException("INVALID_OFFICIAL_GAZETTE_CITATION");
        throw e;
      }
    });
  }

  // PH10.6: root-only, authenticated, no-plaintext-response ClamAV scan.
  // A CLEAN receipt does not release quarantine or make the document authentic.
  @Post("national/cooperative-onboarding-evidence/:evidenceId/scan")
  @HttpCode(201)
  async scanCooperativeQuarantineEvidence(
    @Param("evidenceId",new ParseUUIDPipe()) evidenceId:string,
    @Headers("authorization") auth:string|undefined,
    @Body() input:Record<string,unknown>
  ){
    if(process.env.TTO_ISOLATED_DEMO_DB!=="true")
      throw new ServiceUnavailableException("ONBOARDING_PREVIEW_ONLY");
    const requestKey=requireId(input?.requestKey);
    const key=process.env.TTO_COOP_QUARANTINE_KEY_HEX??"";
    if(!/^[a-fA-F0-9]{64}$/.test(key)||
       !process.env.TTO_COOP_CLAMD_SOCKET)
      throw new ServiceUnavailableException("QUARANTINE_SCANNER_NOT_CONFIGURED");
    const actor=await this.db.sessionActor(auth);
    return this.db.withActor(actor,async client=>{
      const permitted=await client.query<{allowed:boolean}>(
        "SELECT tto.has_national_root() AS allowed");
      if(permitted.rows[0]?.allowed!==true)
        throw new ForbiddenException("NATIONAL_ROOT_REQUIRED");
      const record=await client.query<{ciphertext:Buffer;iv:Buffer;tag:Buffer;
        content_sha256:Buffer;key_version:string;scan_status:string;
        authenticity_status:string}>(
        "SELECT * FROM tto.cooperative_evidence_integrity_packet($1::uuid)",
        [evidenceId]);
      if(record.rowCount!==1)
        throw new BadRequestException("QUARANTINED_EVIDENCE_NOT_FOUND");
      const item=record.rows[0];
      if(item.key_version!=="isolated-v1"||item.scan_status!=="QUARANTINED"||
         item.authenticity_status!=="NOT_VERIFIED")
        throw new ServiceUnavailableException("SCANNER_SCOPE_INVALID");
      let bytes:Buffer;
      try{
        const decipher=createDecipheriv("aes-256-gcm",Buffer.from(key,"hex"),item.iv);
        decipher.setAuthTag(item.tag);
        bytes=Buffer.concat([decipher.update(item.ciphertext),decipher.final()]);
        const digest=createHash("sha256").update(bytes).digest();
        if(digest.length!==item.content_sha256.length||
           !timingSafeEqual(digest,item.content_sha256))
          throw Error("MISMATCH");
      }catch{
        throw new ServiceUnavailableException("EVIDENCE_INTEGRITY_UNCONFIRMED");
      }
      let scan;
      try{scan=await scanQuarantineBytes(bytes);}
      catch{
        throw new ServiceUnavailableException("MALWARE_SCANNER_UNAVAILABLE");
      }finally{
        bytes.fill(0);
      }
      try{
        const out=await client.query<{result:Record<string,unknown>}>(
          "SELECT tto.record_cooperative_malware_scan("+
          "$1::uuid,$2::uuid,$3::bytea,$4::text,$5::text,$6::text,$7::bytea) AS result",
          [evidenceId,requestKey,item.content_sha256,scan.verdict,
           scan.engine,scan.signature,this.db.sessionDigest(auth)]);
        return {evidenceId,...out.rows[0].result};
      }catch(e){
        const code=(e as {code?:string}).code;
        if(code==="23505")throw new ConflictException("SCAN_RECEIPT_REPLAY_CONFLICT");
        if(code==="42501")throw new ForbiddenException("SCAN_RECEIPT_PERMISSION_DENIED");
        if(code==="22023")throw new BadRequestException("INVALID_SCAN_RECEIPT");
        throw e;
      }
    });
  }

  // PH10.5: cryptographic ciphertext integrity only, never source authenticity.
  @Get("national/cooperative-onboarding-evidence/:evidenceId/integrity")
  async checkCooperativeQuarantineIntegrity(
    @Param("evidenceId",new ParseUUIDPipe()) evidenceId:string,
    @Headers("authorization") auth:string|undefined
  ){
    if(process.env.TTO_ISOLATED_DEMO_DB!=="true")
      throw new ServiceUnavailableException("ONBOARDING_PREVIEW_ONLY");
    const key=process.env.TTO_COOP_QUARANTINE_KEY_HEX??"";
    if(!/^[a-fA-F0-9]{64}$/.test(key))
      throw new ServiceUnavailableException("QUARANTINE_KEY_UNAVAILABLE");
    const actor=await this.db.sessionActor(auth);
    return this.db.withActor(actor,async client=>{
      const role=await client.query<{allowed:boolean}>(
        "SELECT tto.has_national_root() AS allowed");
      if(role.rows[0]?.allowed!==true)
        throw new ForbiddenException("NATIONAL_ROOT_REQUIRED");
      const record=await client.query<{ciphertext:Buffer;iv:Buffer;tag:Buffer;
        content_sha256:Buffer;key_version:string;scan_status:string;
        authenticity_status:string}>(
        "SELECT * FROM tto.cooperative_evidence_integrity_packet($1::uuid)",
        [evidenceId]);
      if(record.rowCount!==1)
        throw new BadRequestException("QUARANTINED_EVIDENCE_NOT_FOUND");
      const item=record.rows[0];
      if(item.key_version!=="isolated-v1"||item.scan_status!=="QUARANTINED"||
         item.authenticity_status!=="NOT_VERIFIED")
        throw new ServiceUnavailableException("EVIDENCE_VALIDATION_NOT_AVAILABLE");
      try{
        const decipher=createDecipheriv("aes-256-gcm",Buffer.from(key,"hex"),item.iv);
        decipher.setAuthTag(item.tag);
        const bytes=Buffer.concat([decipher.update(item.ciphertext),decipher.final()]);
        const digest=createHash("sha256").update(bytes).digest();
        if(digest.length!==item.content_sha256.length||
           !timingSafeEqual(digest,item.content_sha256))
          throw Error("INTEGRITY_MISMATCH");
      }catch{
        // No plaintext, decryption error or digest is returned or logged.
        throw new ServiceUnavailableException("EVIDENCE_INTEGRITY_UNCONFIRMED");
      }
      return {evidenceId,integrity:"MATCH",authenticity:"NOT_VERIFIED",
        malwareStatus:"QUARANTINED",externalSourceVerified:false,
        legalApproval:false,tenantCreated:false,managerRoleGranted:false};
    });
  }

  // PH10.5: separate appointed reviewer's reported source comparison.
  // The submission never confirms legal authenticity or releases quarantined data.
  @Post("national/cooperative-onboarding/:dossierId/source-checks")
  @HttpCode(201)
  async recordExternalCooperativeSourceCheck(
    @Param("dossierId",new ParseUUIDPipe()) dossierId:string,
    @Headers("authorization") auth:string|undefined,
    @Body() input:Record<string,unknown>
  ){
    if(process.env.TTO_ISOLATED_DEMO_DB!=="true")
      throw new ServiceUnavailableException("ONBOARDING_PREVIEW_ONLY");
    const evidenceId=requireId(input?.evidenceId);
    const requestKey=requireId(input?.requestKey);
    const sourceKind=input?.sourceKind;
    const sourceReference=input?.sourceReference;
    const sourceHashHex=input?.sourceHashHex;
    const finding=input?.finding;
    const rationale=input?.rationale;
    if(typeof sourceKind!=="string"||
       !["NATIONAL_REGISTRY","OFFICIAL_GAZETTE","COOPERATIVE_AUTHORITY"].includes(sourceKind)||
       typeof sourceReference!=="string"||sourceReference.trim().length<8||
       sourceReference.length>240||
       typeof sourceHashHex!=="string"||!/^[a-fA-F0-9]{64}$/.test(sourceHashHex)||
       typeof finding!=="string"||
       !["MATCH_REPORTED_UNVERIFIED","MISMATCH_REPORTED","INCONCLUSIVE"].includes(finding)||
       typeof rationale!=="string"||rationale.trim().length<10||rationale.length>1500)
      throw new BadRequestException("INVALID_EXTERNAL_SOURCE_CHECK");
    const actor=await this.db.sessionActor(auth);
    return this.db.withActor(actor,async client=>{
      try{
        const out=await client.query<{result:Record<string,unknown>}>(
          "SELECT tto.record_independent_cooperative_source_check("+
          "$1::uuid,$2::uuid,$3::uuid,$4::text,$5::text,$6::bytea,$7::text,$8::text,$9::bytea) AS result",
          [dossierId,evidenceId,requestKey,sourceKind,sourceReference,
           Buffer.from(sourceHashHex,"hex"),finding,rationale,this.db.sessionDigest(auth)]
        );
        return {dossierId,evidenceId,...out.rows[0].result};
      }catch(e){
        const code=(e as {code?:string}).code;
        if(code==="42501")throw new ForbiddenException("INDEPENDENT_REVIEWER_REQUIRED");
        if(code==="23505")throw new ConflictException("SOURCE_CHECK_REPLAY_CONFLICT");
        if(code==="22023")throw new BadRequestException("INVALID_SOURCE_CHECK");
        throw e;
      }
    });
  }

  // PH10.3: draft claims only; no legal registration or tenant role.
  @Get("national/cooperative-onboarding-drafts")
  async listNationalCooperativeDrafts(@Headers("authorization") auth:string|undefined){
    if(process.env.TTO_ISOLATED_DEMO_DB!=="true")
      throw new ServiceUnavailableException("ONBOARDING_PREVIEW_ONLY");
    const actor=await this.db.sessionActor(auth);
    return this.db.withActor(actor,async client=>{
      const check=await client.query<{allowed:boolean}>("SELECT tto.has_national_root() AS allowed");
      if(check.rows[0]?.allowed!==true)throw new ForbiddenException("NATIONAL_ROOT_REQUIRED");
      const rows=await client.query<{slug:string;payload:Record<string,string>;version:number}>(
        "SELECT w.slug,d.payload,d.version FROM tto.cooperative_onboarding_drafts d "+
        "JOIN tto.cooperative_workspace_addresses w ON w.workspace_id=d.workspace_id "+
        "WHERE w.state='RESERVED' AND NOT EXISTS (SELECT 1 FROM "+
        "tto.cooperative_onboarding_dossiers s WHERE s.workspace_id=d.workspace_id) "+
        "ORDER BY d.updated_at DESC LIMIT 100"
      );
      return {items:rows.rows,tenantCreated:false};
    });
  }

  @Post("national/cooperative-onboarding-drafts")
  @HttpCode(200)
  async saveNationalCooperativeDraft(@Headers("authorization") auth:string|undefined,
    @Body() input:Record<string,unknown>){
    if(process.env.TTO_ISOLATED_DEMO_DB!=="true")
      throw new ServiceUnavailableException("ONBOARDING_PREVIEW_ONLY");
    const slug=requireText(input?.slug,3,40);
    if(!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug))
      throw new BadRequestException("INVALID_WORKSPACE_SLUG");
    if(typeof input?.expectedVersion!=="number"||
       !Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<0)
      throw new BadRequestException("INVALID_DRAFT_VERSION");
    const requestKey=requireId(input?.requestKey);
    const payload=input?.payload;
    if(!payload||typeof payload!=="object"||Array.isArray(payload))
      throw new BadRequestException("INVALID_DRAFT_PAYLOAD");
    const allowed=new Set(["legalName","nationalId","registrationNumber","province",
      "county","legalAddress","representativeName","candidateManagerName",
      "candidateManagerMobile","evidenceReference"]);
    const record=payload as Record<string,unknown>;
    if(Object.keys(record).some(key=>!allowed.has(key)||typeof record[key]!=="string"||
       (record[key] as string).length>300)||JSON.stringify(record).length>4096)
      throw new BadRequestException("INVALID_DRAFT_FIELDS");
    const actor=await this.db.sessionActor(auth);
    return this.db.withActor(actor,async client=>{
      try{
        const result=await client.query<{out:Record<string,unknown>}>(
          "SELECT tto.save_cooperative_onboarding_draft($1::text,$2::jsonb,$3::integer,$4::uuid) AS out",
          [slug,JSON.stringify(record),input.expectedVersion,requestKey]
        );
        return result.rows[0].out;
      }catch(e){
        const code=(e as {code?:string}).code;
        if(code==="42501")throw new ForbiddenException("DRAFT_PERMISSION_DENIED");
        if(code==="23505"||code==="40001")
          throw new ConflictException("DRAFT_VERSION_OR_KEY_CONFLICT");
        if(code==="22023")throw new BadRequestException("INVALID_DRAFT");
        throw e;
      }
    });
  }

  // PH10.2: auditable review only. Never grants legal authority or provisions a tenant.
  @Post("national/cooperative-onboarding/:dossierId/actions")
  @HttpCode(200)
  async reviewNationalCooperativeOnboarding(
    @Param("dossierId",new ParseUUIDPipe()) dossierId:string,
    @Headers("authorization") auth:string|undefined,
    @Body() input:Record<string,unknown>
  ){
    if(process.env.TTO_ISOLATED_DEMO_DB!=="true")
      throw new ServiceUnavailableException("ONBOARDING_PREVIEW_ONLY");
    const action=input?.action;
    const allowed=new Set(["START_REVIEW","REQUEST_CHANGES","REJECT",
                           "RESUBMIT","REFER_EXTERNAL_REVIEW","RECOMMEND_EXTERNAL_APPROVAL"]);
    if(typeof action!=="string"||!allowed.has(action))
      throw new BadRequestException("INVALID_REVIEW_ACTION");
    const expectedVersion=input?.expectedVersion;
    if(typeof expectedVersion!=="number"||!Number.isSafeInteger(expectedVersion)||
       expectedVersion<1)throw new BadRequestException("INVALID_REVIEW_VERSION");
    const requestKey=requireId(input?.requestKey);
    const reason=input?.reason;
    if(reason!==undefined&&(typeof reason!=="string"||reason.length>1500))
      throw new BadRequestException("INVALID_REVIEW_REASON");
    const evidence=input?.evidenceReference;
    if(evidence!==undefined&&(typeof evidence!=="string"||
       evidence.length>180))throw new BadRequestException("INVALID_EVIDENCE_REFERENCE");
    const actor=await this.db.sessionActor(auth);
    return this.db.withActor(actor,async client=>{
      try{
        const result=await client.query<{out:Record<string,unknown>}>(
          "SELECT tto.review_cooperative_onboarding($1::uuid,$2::text,$3::integer,"+
          "$4::uuid,$5::text,$6::text) AS out",
          [dossierId,action,expectedVersion,requestKey,reason??null,evidence??null]
        );
        return result.rows[0].out;
      }catch(e){
        const code=(e as {code?:string}).code;
        if(code==="42501")throw new ForbiddenException("REVIEW_PERMISSION_DENIED");
        if(code==="23505"||code==="40001")
          throw new ConflictException("REVIEW_VERSION_OR_IDEMPOTENCY_CONFLICT");
        if(code==="22023")throw new BadRequestException("INVALID_REVIEW_TRANSITION");
        throw e;
      }
    });
  }

  @Post("national/cooperative-intakes")
  @HttpCode(201)
  async createNationalCooperativeIntake(
    @Headers("authorization") auth:string|undefined,@Body() input:Record<string,unknown>
  ){
    // Preview DB must be explicitly confirmed disposable. This is NOT tenant creation.
    if(process.env.TTO_ISOLATED_DEMO_DB!=="true")
      throw new ServiceUnavailableException("ISOLATED_DEMO_DATABASE_REQUIRED");
    const name=requireText(input?.name,8,180).trim();
    const registrationNumber=requireText(input?.registrationNumber,1,20).trim();
    const nationalId=requireText(input?.nationalId,11,11).trim();
    const province=requireText(input?.province,2,120).trim();
    const county=requireText(input?.county,2,120).trim();
    const address=requireText(input?.address,4,300).trim();
    const representative=requireText(input?.representative,2,120).trim();
    if(!/^[0-9]{11}$/.test(nationalId)||!/^[0-9]{1,20}$/.test(registrationNumber))
      throw new BadRequestException("INVALID_COMPANY_IDENTIFIERS");
    const actor=await this.db.sessionActor(auth);
    return this.db.withActor(actor,async client=>{
      const access=await client.query<{allowed:boolean}>(
        'SELECT EXISTS (SELECT 1 FROM tto.list_actor_tenant_options() WHERE "platformOperator" IS TRUE) AS allowed'
      );
      if(access.rows[0]?.allowed!==true)throw new ForbiddenException("NATIONAL_PLATFORM_OPERATOR_REQUIRED");
      // The unique constraint enforces idempotency; broad SELECT is intentionally disallowed by RLS.
      const id=randomUUID();
      try{
        await client.query(
          "INSERT INTO tto.national_cooperative_intake (intake_id,national_id,registration_number,legal_name,province,county,legal_address,representative,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
          [id,nationalId,registrationNumber,name,province,county,address,representative,actor]
        );
        await client.query(
          "INSERT INTO tto.national_cooperative_intake_audit (intake_id,actor_id,event_type) VALUES ($1,$2,'INTAKE_CREATED')",
          [id,actor]
        );
      }catch(e){
        if((e as {code?:string}).code==="23505")
          throw new ConflictException("NATIONAL_ID_ALREADY_SUBMITTED");
        throw e;
      }
      return {intakeId:id,status:"PENDING_VERIFICATION",created:true,tenantCreated:false};
    });
  }

  @Post("tenants/:tenantId/lifecycle/transition")
  async transitionTenant(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
    @Headers("authorization") auth:string|undefined,@Body() input:Record<string,unknown>){
    const oldState=requireText(input?.fromStatus,3,40);
    const nextState=requireText(input?.toStatus,3,40);
    const version=input?.expectedVersion;
    if(!Number.isSafeInteger(version)||Number(version)<1)throw new BadRequestException("Invalid entity version");
    const approved=await this.run<boolean>(tenant,auth,
      "SELECT tto.transition_tenant($1,$2,$3,$4,tto.context_actor_id()) AS out",
      [tenant,oldState,nextState,version]);
    if(!approved)throw new ForbiddenException("Tenant transition denied");
    return {transitioned:true};
  }
  @Post("tenants/:tenantId/slug/transition")
  async changeTenantSlug(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
    @Headers("authorization") auth:string|undefined,@Body() input:Record<string,unknown>){
    const slug=requireText(input?.newSlug,2,101);
    if(!/^[a-z0-9][a-z0-9-]{1,100}$/.test(slug))
      throw new BadRequestException("Invalid tenant slug");
    const version=input?.expectedVersion;
    if(!Number.isSafeInteger(version)||Number(version)<1)
      throw new BadRequestException("Invalid entity version");
    const changed=await this.run<boolean>(tenant,auth,
      "SELECT tto.change_tenant_slug($1,$2,$3) AS out",[tenant,slug,version]);
    if(!changed)throw new ForbiddenException("Tenant slug transition denied");
    return {changed:true};
  }
  @Post("tenants/:tenantId/parties/aliases/merge")
  async mergeParty(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
    @Headers("authorization") auth:string|undefined,@Body() input:Record<string,unknown>){
    const oldParty=requireId(input?.oldPartyId),currentParty=requireId(input?.currentPartyId);
    const approved=await this.run<boolean>(tenant,auth,
      "SELECT tto.merge_party_alias($1,$2,$3,tto.context_actor_id()) AS out",
      [oldParty,currentParty,tenant]);
    if(!approved)throw new ForbiddenException("Party merge denied");
    return {aliased:true};
  }
  @Post("tenants/:tenantId/legal-holds/:holdId/release")
  async releaseHold(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
    @Param("holdId",new ParseUUIDPipe()) hold:string,
    @Headers("authorization") auth:string|undefined,@Body() input:Record<string,unknown>){
    const evidence=requireId(input?.releaseEvidenceId);
    const approved=await this.run<boolean>(tenant,auth,
      "SELECT tto.release_legal_hold($1,$2) AS out",[hold,evidence]);
    if(!approved)throw new ForbiddenException("Hold release denied");
    return {released:true};
  }
  @Get("me/tenant-options")
  async listActorTenantOptions(@Headers("authorization") auth?:string){
    const actor=await this.db.sessionActor(auth);
    return this.db.withActor(actor,async client=>{
      const result=await client.query<{
        tenantId:string;displayName:string;memberRole:boolean;managerRole:boolean;
        verifiedPartyLink:boolean;activeMembershipProjection:boolean;
        roleManagementAuthority:boolean;approvedDocumentJit:boolean;platformOperator:boolean
      }>("SELECT * FROM tto.list_actor_tenant_options()");
      return {items:result.rows};
    });
  }
  // Candidate Child07/Child09 source read-model routes. Always fail closed.
  // Neither a tenant role nor an authenticated session proves shareholder
  // standing, source approval, publication or recipient authorization.
  @Get("tenants/:tenantId/me/trade-requests")
  async ownTradeRequests(@Param("tenantId",new ParseUUIDPipe()) _tenant:string,
    @Headers("authorization") auth?:string){
    await this.db.sessionActor(auth);
    throw new ForbiddenException("Source or permission not approved");
  }
  @Get("tenants/:tenantId/me/notices")
  async ownPublishedNotices(@Param("tenantId",new ParseUUIDPipe()) _tenant:string,
    @Headers("authorization") auth?:string){
    await this.db.sessionActor(auth);
    throw new ForbiddenException("Source or permission not approved");
  }
  // CF02 staged legal-identity case: no document bytes or Party data returned.
  // Request always applies to the verified session actor, never a target user from JSON.
  @Post("tenants/:tenantId/identity-links")
  async requestIdentityLink(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
    @Headers("authorization") auth:string|undefined,@Body() input:Record<string,unknown>){
    const party=requireId(input?.partyId),evidence=requireId(input?.evidenceId);
    const result=await this.run<string|null>(tenant,auth,
      "SELECT tto.request_identity_link($1,$2,$3) AS out",[tenant,party,evidence]);
    if(!result)throw new ForbiddenException("Identity link request denied");
    return {caseId:result,status:"PENDING"};
  }
  @Get("tenants/:tenantId/identity-links/:caseId")
  async ownIdentityLinkCase(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
    @Param("caseId",new ParseUUIDPipe()) caseId:string,
    @Headers("authorization") auth?:string){
    const status=await this.run<string|null>(tenant,auth,
      "SELECT tto.my_identity_link_case_status($1,$2) AS out",[tenant,caseId]);
    if(!status)throw new ForbiddenException("Identity case access denied");
    return {status};
  }
  @Post("tenants/:tenantId/identity-links/:caseId/decision")
  async decideIdentityLink(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
    @Param("caseId",new ParseUUIDPipe()) caseId:string,
    @Headers("authorization") auth:string|undefined,@Body() input:Record<string,unknown>){
    if(typeof input?.approve!=="boolean")throw new BadRequestException("Decision required");
    const evidence=requireId(input?.decisionEvidenceId);
    const version=input?.expectedVersion;
    if(!Number.isSafeInteger(version)||Number(version)<1)throw new BadRequestException("Invalid expected version");
    const accepted=await this.run<boolean>(tenant,auth,
      "SELECT tto.decide_identity_link($1,$2,$3,$4,$5) AS out",
      [tenant,caseId,evidence,input.approve,version]);
    if(!accepted)throw new ForbiddenException("Identity decision denied");
    return {recorded:true};
  }
  // Child06/07 read-only self service: private user data is resolved solely
  // from approved source snapshots and live verified actor/tenant context.
  @Get("tenants/:tenantId/me/member-record")
  async ownMemberRecord(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
    @Headers("authorization") auth?:string){
    const record=await this.run<Record<string,unknown>|null>(tenant,auth,
      "SELECT tto.my_member_profile_from_source($1) AS out",[tenant]);
    if(!record)throw new ForbiddenException("Verified member record unavailable");
    return {record};
  }
  @Get("tenants/:tenantId/me/shareholding")
  async ownShareholding(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
    @Headers("authorization") auth?:string){
    const record=await this.run<Record<string,unknown>|null>(tenant,auth,
      "SELECT tto.my_shareholding_from_source($1) AS out",[tenant]);
    if(!record)throw new ForbiddenException("Verified shareholding unavailable");
    return {record};
  }
  /** Preview-only enrollment. A verified mobile creates an ordinary user,
   * NEVER a national operator, manager or tenant assignment. */
  /**
   * Owner-authenticated national root login, separate from SMS OTP.
   * Guarded by branch-scoped Preview secrets and Postgres rate limits.
   * A valid credential alone cannot create or approve any other root.
   */
  @Post("national/root/login")
  @HttpCode(200)
  async loginNationalRoot(@Body() input:Record<string,unknown>,@Req() req:{ip?:string}){
    if(process.env.TTO_NATIONAL_ROOT_LOGIN_ENABLED!=="true" ||
       process.env.TTO_ISOLATED_DEMO_DB!=="true" ||
       (process.env.VERCEL==="1" && process.env.VERCEL_ENV!=="preview"))
      throw new ServiceUnavailableException("NATIONAL_LOGIN_UNAVAILABLE");
    const username=input?.username;
    const password=input?.password;
    if(typeof username!=="string" || username.length>64 ||
       typeof password!=="string" || password.length>128)
      throw new BadRequestException("INVALID_CREDENTIAL_REQUEST");
    const secret=process.env.TTO_NATIONAL_ROOT_ATTEMPT_SECRET;
    const initialUsername=process.env.TTO_NATIONAL_ROOT_USERNAME;
    const initialHash=process.env.TTO_NATIONAL_ROOT_PASSWORD_SCRYPT;
    const ip=req?.ip;
    if(!secret||Buffer.byteLength(secret)<32||
       typeof ip!=="string"||ip.length<3||ip.length>64)
      throw new ServiceUnavailableException("NATIONAL_LOGIN_UNAVAILABLE");
    const fingerprint=createHmac("sha256",secret).update("national-login-ip:"+ip).digest();
    const globalKey=createHmac("sha256",secret).update("national-login-global").digest();
    if(!await this.db.reserveNationalRootAttempt(fingerprint) ||
       !await this.db.reserveNationalRootAttempt(globalKey))
      throw new ForbiddenException("LOGIN_RATE_LIMITED");
    const state=await this.db.nationalRootCredentialState();
    if(!state)throw new ServiceUnavailableException("NATIONAL_ROOT_NOT_PROVISIONED");
    // Once a new credential is stored, the original bootstrap secret is permanently retired.
    const effectiveUsername=state.password_scrypt?state.username:initialUsername;
    const effectiveHash=state.password_scrypt??initialHash;
    if(!effectiveUsername || !effectiveHash)
      throw new ServiceUnavailableException("NATIONAL_LOGIN_UNAVAILABLE");
    if(!verifyNationalPassword(password,effectiveHash) ||
       !timingSafeEqual(createHash("sha256").update(username).digest(),
        createHash("sha256").update(effectiveUsername).digest()))
      throw new UnauthorizedException("INVALID_CREDENTIALS");
    const token=randomBytes(48).toString("base64url");
    const tokenHash=createHash("sha256").update(token).digest();
    const created=await this.db.issueNationalRootSession(tokenHash,state.credentials_version);
    if(!created)throw new ServiceUnavailableException("NATIONAL_LOGIN_RETRY_REQUIRED");
    return {accessToken:token,tokenType:"Bearer",nationalRoot:true,
      mustChangeCredentials:state.must_change_credentials};
  }

  @Get("national/root/session")
  async nationalRootSession(@Headers("authorization") auth?:string){
    const actor=await this.db.sessionActor(auth);
    const status=await this.db.withActor(actor,async client=>{
      const r=await client.query<{principal:boolean;must_change:boolean}>(
        "SELECT tto.is_national_root_principal() AS principal,tto.national_root_requires_change() AS must_change");
      return r.rows[0];
    });
    if(status?.principal!==true)throw new ForbiddenException("NATIONAL_ROOT_REQUIRED");
    return {authenticated:true,nationalRoot:true,
      mustChangeCredentials:status.must_change===true};
  }

  @Post("national/root/change-credentials")
  @HttpCode(200)
  async changeNationalRootCredentials(@Headers("authorization") auth:string|undefined,
    @Body() input:Record<string,unknown>){
    if(process.env.TTO_NATIONAL_ROOT_LOGIN_ENABLED!=="true" ||
       process.env.TTO_ISOLATED_DEMO_DB!=="true" ||
       (process.env.VERCEL==="1" && process.env.VERCEL_ENV!=="preview"))
      throw new ServiceUnavailableException("NATIONAL_LOGIN_UNAVAILABLE");
    const username=input?.newUsername;
    const password=input?.newPassword;
    const current=input?.currentPassword;
    if(typeof username!=="string"||!/^[A-Za-z0-9._-]{5,64}$/.test(username)||
       typeof password!=="string"||password.length<14||password.length>128||
       Buffer.byteLength(password)>256||/^\\d+$/.test(password)||
       typeof current!=="string"||current.length<1||current.length>128)
      throw new BadRequestException("WEAK_NEW_CREDENTIALS");
    const actor=await this.db.sessionActor(auth);
    const state=await this.db.nationalRootCredentialState();
    const currentUser=state?.password_scrypt?state.username:process.env.TTO_NATIONAL_ROOT_USERNAME;
    const currentHash=state?.password_scrypt??process.env.TTO_NATIONAL_ROOT_PASSWORD_SCRYPT;
    if(!state||!currentUser||!currentHash)
      throw new ServiceUnavailableException("NATIONAL_LOGIN_UNAVAILABLE");
    if(username===currentUser||password===current||
       password.includes(currentUser)||password.includes(username))
      throw new BadRequestException("NEW_CREDENTIALS_MUST_DIFFER");
    if(!verifyNationalPassword(current,currentHash))
      throw new UnauthorizedException("INVALID_CREDENTIALS");
    const salt=randomBytes(16).toString("hex");
    const digest=scryptSync(password,Buffer.from(salt,"hex"),64,
      {N:16384,r:8,p:1,maxmem:64*1024*1024}).toString("hex");
    const encoded="scrypt$v1$"+salt+"$"+digest;
    const changed=await this.db.withActor(actor,async client=>{
      const response=await client.query<{changed:boolean}>(
       "SELECT tto.rotate_national_root_credentials($1,$2,$3::bigint,$4) AS changed",
       [username,encoded,state.credentials_version,this.db.sessionDigest(auth)]);
      return response.rows[0]?.changed===true;
    });
    if(!changed)throw new ForbiddenException("NATIONAL_ROOT_CREDENTIAL_CHANGE_DENIED");
    // PostgreSQL revokes every existing root session, including this request's cookie.
    return {changed:true,sessionsRevoked:true,loginRequired:true};
  }

  @Post("auth/registration/request")
  @HttpCode(202)
  async requestMobileRegistration(@Body() input:Record<string,unknown>,@Req() req:{ip?:string}){
    if(process.env.TTO_ISOLATED_DEMO_DB!=="true" ||
       process.env.TTO_ENABLE_MOBILE_REGISTRATION!=="true")
      throw new ServiceUnavailableException("REGISTRATION_NOT_ENABLED");
    const mobile=input?.mobile;
    if(typeof mobile!=="string" || !/^09[0-9]{9}$/.test(mobile))
      throw new BadRequestException("INVALID_MOBILE");
    const pepper=process.env.AUTH_CHALLENGE_HMAC_SECRET;
    const guard=process.env.AUTH_ABUSE_HMAC_SECRET;
    const ip=req?.ip;
    if(!pepper||Buffer.byteLength(pepper)<32 ||
       !guard||Buffer.byteLength(guard)<32 ||
       typeof ip!=="string"||ip.length<3||ip.length>64)
      throw new ServiceUnavailableException("AUTH_CAPACITY_UNAVAILABLE");
    const synthetic=process.env.NODE_ENV==="test" &&
       process.env.TTO_MOCK_SMSOTP_PROVIDER==="true";
    if(!synthetic &&
      (process.env.TTO_ENABLE_REAL_SMSOTP_DELIVERY!=="true" ||
       !process.env.APIIR_TOKEN || process.env.APIIR_TOKEN.length<12))
      throw new ServiceUnavailableException("SMS_DELIVERY_UNAVAILABLE");
    const requestId=randomUUID();
    const ipKey=createHmac("sha256",guard).update("ip:v1:"+ip).digest();
    const mobileKey=createHmac("sha256",guard).update("mobile:v1:"+mobile).digest();
    let allowed=false;
    try{allowed=await this.db.reservePublicOtpRequest(ipKey,mobileKey)}
    catch{throw new ServiceUnavailableException("AUTH_CAPACITY_UNAVAILABLE")}
    if(!allowed)return {requestId,status:"ACCEPTED"};
    const code=synthetic?"111222":String(randomInt(100000,1000000));
    const hash=createHmac("sha256",pepper).update(requestId+":"+code).digest();
    const created=await this.db.beginMobileRegistration(mobile,requestId,hash);
    if(created){
      let sent=false;
      try{sent=await this.sms.send(mobile,code)}catch{sent=false}
      await this.db.attestSmsDelivery(requestId,sent);
    }
    // Do not reveal whether this mobile already exists or is throttled.
    return {requestId,status:"ACCEPTED"};
  }

  @Post("auth/registration/verify")
  @HttpCode(200)
  async verifyMobileRegistration(@Body() input:Record<string,unknown>){
    if(process.env.TTO_ISOLATED_DEMO_DB!=="true" ||
       process.env.TTO_ENABLE_MOBILE_REGISTRATION!=="true")
      throw new ServiceUnavailableException("REGISTRATION_NOT_ENABLED");
    const id=requireId(input?.challengeId);
    if(typeof input?.otp!=="string"||!/^[0-9]{6}$/.test(input.otp))
      throw new BadRequestException("INVALID_CODE");
    const pepper=process.env.AUTH_CHALLENGE_HMAC_SECRET;
    if(!pepper||Buffer.byteLength(pepper)<32)
      throw new ServiceUnavailableException("AUTH_UNAVAILABLE");
    const digest=createHmac("sha256",pepper).update(id+":"+input.otp).digest();
    const accessToken=randomBytes(48).toString("base64url");
    const sessionHash=createHash("sha256").update(accessToken).digest();
    const accepted=await this.db.consumeMobileRegistration(id,digest,sessionHash);
    if(!accepted)throw new UnauthorizedException("INVALID_OR_EXPIRED_CODE");
    return {accessToken,tokenType:"Bearer",nationalOperator:false};
  }

  @Post("auth/challenges/request")
  @HttpCode(202)
  async requestSmsLogin(@Body() payload:Record<string,unknown>,@Req() req:{ip?:string}){
    const mobile=payload?.mobile;
    if(typeof mobile!=="string" || !/^09[0-9]{9}$/.test(mobile))
      throw new BadRequestException("Invalid mobile");
    const pepper=process.env.AUTH_CHALLENGE_HMAC_SECRET;
    if(!pepper || Buffer.byteLength(pepper)<32)
      throw new ServiceUnavailableException("Authentication unavailable");
    // Do not make public issuance available without an actual configured SMS provider
    // or explicit test-only delivery mode. No SMS credentials in browser code.
    const fake=process.env.NODE_ENV==="test" && process.env.TTO_MOCK_SMSOTP_PROVIDER==="true";
    if(!fake && (process.env.TTO_ENABLE_REAL_SMSOTP_DELIVERY!=="true" ||
        !process.env.APIIR_TOKEN || process.env.APIIR_TOKEN.length<12))
      throw new ServiceUnavailableException("SMS provider unavailable");
    const requestId=randomUUID();
    // In regular runtime, missing abuse guard configuration or SQL function must fail CLOSED.
    // Legacy isolated NODE_ENV=test fixtures may omit it unless explicitly opting in.
    const enforceAbuseGuard=process.env.NODE_ENV!=="test" ||
      process.env.TTO_ENFORCE_ABUSE_GUARD==="true";
    if(enforceAbuseGuard){
      const secret=process.env.AUTH_ABUSE_HMAC_SECRET;
      const ip=req?.ip;
      if(!secret || Buffer.byteLength(secret)<32 || typeof ip!=="string" ||
         ip.length<3 || ip.length>64)
        throw new ServiceUnavailableException("Authentication capacity unavailable");
      // IPv4/IPv6 are supplied by Fastify request.ip from the actual socket.
      // Do not consume public X-Forwarded-For or user-supplied device identifier.
      const ipKey=createHmac("sha256",secret).update("ip:v1:"+ip).digest();
      const mobileKey=createHmac("sha256",secret).update("mobile:v1:"+mobile).digest();
      try{
        const allowed=await this.db.reservePublicOtpRequest(ipKey,mobileKey);
        // Generic response prevents the limit revealing enrolled mobile identifiers.
        if(!allowed) return {requestId,status:"ACCEPTED"};
      }catch{
        throw new ServiceUnavailableException("Authentication capacity unavailable");
      }
    }
    const code=fake ? "111222" : String(randomInt(100000,1000000));
    const digest=createHmac("sha256",pepper).update(requestId+":"+code).digest();
    const created=await this.db.prepareSmsLogin(mobile,requestId,digest);
    if(created){
      let accepted=false;
      try { accepted=await this.sms.send(mobile,code); } catch { accepted=false; }
      const updated=await this.db.attestSmsDelivery(requestId,accepted);
      // Generic response, no account enumeration, no OTP or provider body leaks.
      if(!updated) throw new ServiceUnavailableException("Authentication delivery failed");
    }
    return {requestId,status:"ACCEPTED"};
  }
  @Post("auth/challenges/verify")
  @HttpCode(200)
  async verify(@Body() payload:Record<string,unknown>){
    // The challenge is delivered only by a separately approved provider.
    // No issuance/delivery API is exposed until secure identifiers & delivery are complete.
    const id=requireId(payload?.challengeId);
    if(typeof payload?.otp!=="string"||!/^[0-9]{6,10}$/.test(payload.otp))
      throw new BadRequestException("Invalid verification code");
    const pepper=process.env.AUTH_CHALLENGE_HMAC_SECRET;
    if(!pepper || Buffer.byteLength(pepper)<32)
      throw new ServiceUnavailableException("Authentication delivery not configured");
    const hashedCandidate=createHmac("sha256",pepper).update(id+":"+payload.otp).digest();
    const token=randomBytes(48).toString("base64url");
    const digest=createHash("sha256").update(token).digest();
    const accepted=await this.db.consumeChallenge(id,hashedCandidate,digest);
    if(!accepted)throw new UnauthorizedException("Challenge invalid or expired");
    return {accessToken:token,tokenType:"Bearer"};
  }
  @Post("auth/step-up/request")
  @HttpCode(202)
  async requestStepUp(@Headers("authorization") auth:string|undefined){
    const actor=await this.db.sessionActor(auth);
    const secret=process.env.AUTH_CHALLENGE_HMAC_SECRET;
    if(!secret||Buffer.byteLength(secret)<32)
      throw new ServiceUnavailableException("Step-up authentication unavailable");
    const mock=process.env.NODE_ENV==="test"&&process.env.TTO_MOCK_SMSOTP_PROVIDER==="true";
    if(!mock&&(process.env.TTO_ENABLE_REAL_SMSOTP_DELIVERY!=="true"||
      !process.env.APIIR_TOKEN||process.env.APIIR_TOKEN.length<12))
      throw new ServiceUnavailableException("Step-up SMS provider unavailable");
    const requestId=randomUUID();
    const code=mock?"111222":String(randomInt(100000,1000000));
    const digest=createHmac("sha256",secret).update(requestId+":"+code).digest();
    const sessionHash=this.db.sessionDigest(auth);
    const mobile=await this.db.withActor(actor,async client=>{
      const result=await client.query<{mobile:string|null}>(
        "SELECT tto.begin_session_stepup_smsotp($1,$2,$3) AS mobile",
        [requestId,digest,sessionHash]);
      return result.rows[0]?.mobile??null;
    });
    if(!mobile)return {requestId,status:"ACCEPTED"};
    let delivered=false;
    try {delivered=mock||await this.sms.send(mobile,code)}catch{delivered=false}
    await this.db.attestSmsDelivery(requestId,delivered);
    // Generic response. No mobile, OTP, proof or session data is returned.
    return {requestId,status:"ACCEPTED"};
  }
  @Post("auth/step-up/verify")
  @HttpCode(200)
  async verifyStepUp(@Headers("authorization") auth:string|undefined,
    @Body() payload:Record<string,unknown>){
    const actor=await this.db.sessionActor(auth);
    const challenge=requireId(payload?.challengeId);
    if(typeof payload?.otp!=="string"||!/^[0-9]{6,10}$/.test(payload.otp))
      throw new BadRequestException("Invalid verification code");
    const secret=process.env.AUTH_CHALLENGE_HMAC_SECRET;
    if(!secret||Buffer.byteLength(secret)<32)
      throw new ServiceUnavailableException("Step-up authentication unavailable");
    const candidate=createHmac("sha256",secret).update(challenge+":"+payload.otp).digest();
    const sessionHash=this.db.sessionDigest(auth);
    const ok=await this.db.withActor(actor,async client=>{
      const result=await client.query<{verified:boolean}>(
        "SELECT tto.consume_session_stepup_smsotp($1,$2,$3) AS verified",
        [challenge,candidate,sessionHash]);
      return result.rows[0]?.verified===true;
    });
    if(!ok)throw new UnauthorizedException("Step-up verification denied");
    return {elevated:true,validForSeconds:300};
  }
  // Authentication only: never infer any tenant role, legal authority or national-admin scope.
  @Get("auth/session")
  async session(@Headers("authorization") auth?:string){
    await this.db.sessionActor(auth); // real PostgreSQL resolve_session validates expiry/revocation
    return {authenticated:true};
  }
  @Post("auth/logout")
  @HttpCode(204)
  async logout(@Headers("authorization") auth?:string){
    const actor=await this.db.sessionActor(auth);
    await this.db.withActor(actor,async client=>client.query("SELECT tto.revoke_own_sessions()"));
  }
  @Post("tenants/:tenantId/roles/assign")
  async assign(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
    @Headers("authorization") auth:string|undefined,@Body() input:Record<string,unknown>){
    const target=requireId(input?.targetId),legal=requireId(input?.legalAuthorityId);
    const requestId=requireId(input?.requestId);
    const role=requireText(input?.roleCode,2,40);
    if(!["MEMBER","COOPERATIVE_MANAGER","DOCUMENT_REVIEWER"].includes(role))
      throw new BadRequestException("Unsupported role");
    const actor=await this.db.sessionActor(auth);
    const sessionHash=this.db.sessionDigest(auth);
    const decision=await this.db.inTenant(actor,tenant,async client=>{
      const r=await client.query<{out:string}>(
        "SELECT tto.assign_tenant_role_guarded($1,$2,$3,$4,$5,$6) AS out",
        [target,tenant,role,legal,requestId,sessionHash]);
      return r.rows[0]?.out??"PERMISSION_DENIED";
    });
    if(decision==="ASSIGNED")return {assigned:true,requestId,alreadyApplied:false};
    if(decision==="ALREADY_APPLIED")return {assigned:true,requestId,alreadyApplied:true};
    if(decision==="IDEMPOTENCY_CONFLICT")
      throw new ConflictException({code:"IDEMPOTENCY_CONFLICT",message:"Request ID reused with different assignment"});
    if(decision==="STEP_UP_REQUIRED")
      throw new ForbiddenException({code:"STEP_UP_REQUIRED",message:"Fresh session-bound verification required"});
    if(decision==="AUTHORITY_REQUIRED")
      throw new ForbiddenException({code:"AUTHORITY_REQUIRED",message:"Independent legal authority required"});
    throw new ForbiddenException({code:"PERMISSION_DENIED",message:"Role assignment permission denied"});
  }
  @Post("tenants/:tenantId/roles/:assignmentId/revoke")
  async revoke(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
    @Param("assignmentId",new ParseUUIDPipe()) assignment:string,
    @Headers("authorization") auth:string|undefined,@Body() input:Record<string,unknown>){
    const version=input?.expectedVersion;
    if(!Number.isSafeInteger(version)||Number(version)<1)
      throw new BadRequestException("Invalid expected version");
    const actor=await this.db.sessionActor(auth);
    const digest=this.db.sessionDigest(auth);
    const decision=await this.db.inTenant(actor,tenant,async client=>{
      const r=await client.query<{out:string}>(
        "SELECT tto.revoke_role_assignment_guarded($1,$2,$3) AS out",
        [assignment,version,digest]);
      return r.rows[0]?.out??"PERMISSION_DENIED";
    });
    if(decision==="REVOKED")return {revoked:true};
    if(decision==="STEP_UP_REQUIRED")
      throw new ForbiddenException({code:"STEP_UP_REQUIRED",message:"Fresh session-bound verification required"});
    if(decision==="AUTHORITY_REQUIRED")
      throw new ForbiddenException({code:"AUTHORITY_REQUIRED",message:"Independent legal authority required"});
    throw new ForbiddenException({code:"PERMISSION_DENIED",message:"Role revocation denied"});
  }
  @Post("tenants/:tenantId/jit/requests")
  async requestJit(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
    @Headers("authorization") auth:string|undefined,@Body() input:Record<string,unknown>){
    const purpose=requireText(input?.purpose,12,500),minutes=input?.minutes;
    if(!Number.isSafeInteger(minutes)||Number(minutes)<1||Number(minutes)>60)
      throw new BadRequestException("Invalid JIT expiry");
    const expiry=new Date(Date.now()+Number(minutes)*60000);
    const grant=await this.run<string>(tenant,auth,"SELECT tto.request_jit($1,$2,$3) AS out",
      [tenant,purpose,expiry]);
    return {requestId:grant,status:"PENDING"};
  }
  @Post("tenants/:tenantId/jit/requests/:grantId/decision")
  async decideJit(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
    @Param("grantId",new ParseUUIDPipe()) grant:string,
    @Headers("authorization") auth:string|undefined,@Body() input:Record<string,unknown>){
    if(typeof input?.approve!=="boolean")throw new BadRequestException("Decision required");
    const ok=await this.run<boolean>(tenant,auth,"SELECT tto.decide_jit($1,$2) AS out",[grant,input.approve]);
    if(!ok)throw new ForbiddenException("JIT approval denied");
    return {recorded:true};
  }
  @Post("tenants/:tenantId/documents/:documentId/versions")
  async publishDocument(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
    @Param("documentId",new ParseUUIDPipe()) doc:string,
    @Headers("authorization") auth:string|undefined,@Body() input:Record<string,unknown>){
    const file=requireId(input?.cleanFileId),version=input?.version;
    if(!Number.isSafeInteger(version)||Number(version)<1)
      throw new BadRequestException("Invalid version");
    const ok=await this.run<boolean>(tenant,auth,"SELECT tto.publish_document($1,$2,$3) AS out",
      [doc,file,version]);
    if(!ok)throw new ForbiddenException("Publication denied");
    return {published:true,version};
  }
  @Post("tenants/:tenantId/documents/:documentId/legal-holds")
  async placeHold(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
    @Param("documentId",new ParseUUIDPipe()) doc:string,
    @Headers("authorization") auth:string|undefined,@Body() input:Record<string,unknown>){
    const rule=requireText(input?.ruleReference,8,128),reason=requireText(input?.reason,12,1024);
    const hold=await this.run<string|null>(tenant,auth,"SELECT tto.place_legal_hold($1,$2,$3) AS out",
      [doc,rule,reason]);
    if(!hold)throw new ForbiddenException("Legal hold denied");
    return {holdId:hold};
  }
}

/**
 * PCS-010 — quarantined lab operation: real Nest/PG session, real tenant role,
 * PostgreSQL append-only audit, but fictional evidence only. Not a source importer.
 */
@Controller("v1/pcs010-lab/tenants")
export class Pcs010FixtureController {
 constructor(private readonly db:Database) {}
 @Get(":tenantId/fixture-reviews")
 async listFake(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
  @Headers("authorization") auth:string|undefined) {
  if(process.env.CI!=="true"||process.env.TTO_PCS010_LAB!=="1"||
      !!process.env.VERCEL||!!process.env.APIIR_TOKEN||
      !/^postgresql:\/\/tto_app@127\.0\.0\.1:5432\/tto$/.test(process.env.DATABASE_URL??""))
    throw new ForbiddenException("Lab operation disabled");
  const actor=await this.db.sessionActor(auth);
  return this.db.inTenant(actor,tenant,async client=>{
    await client.query("SELECT set_config('tto.pcs010_lab','1',true)");
    const count=await client.query<{n:string}>("SELECT tto.pcs010_fixture_review_count($1)::text AS n",[tenant]);
    const allowed=await client.query<{allowed:boolean}>(
      "SELECT tto.has_tenant_role($1,'COOPERATIVE_MANAGER') AS allowed",[tenant]);
    if(allowed.rows[0]?.allowed!==true)throw new ForbiddenException("Manager role required");
    const history=await client.query<{id:string;fixture_ref:string;event_kind:string;recorded_at:string}>(
      "SELECT id::text,fixture_ref,event_kind,recorded_at FROM tto.pcs012_fixture_review_history($1)",[tenant]);
    return {kind:"SYNTHETIC_ONLY",official:false,canTrade:false,items:Number(count.rows[0]?.n??"0"),
      events:history.rows.map(e=>({id:e.id,fixtureRef:e.fixture_ref,status:e.event_kind,recordedAt:e.recorded_at}))};
  });
 }
 @Post(":tenantId/fixture-reviews")
 async approveFake(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
  @Headers("authorization") auth:string|undefined,@Body() input:Record<string,unknown>) {
  if(process.env.CI!=="true"||process.env.TTO_PCS010_LAB!=="1"||
      !!process.env.VERCEL||!!process.env.APIIR_TOKEN||
      !/^postgresql:\/\/tto_app@127\.0\.0\.1:5432\/tto$/.test(process.env.DATABASE_URL??""))
    throw new ForbiddenException("Lab operation disabled");
  const fixtureRef=String(input?.fixtureRef??"");
  if(!/^PCS010-FAKE-[A-Za-z0-9_-]{8,60}$/.test(fixtureRef))
    throw new BadRequestException("Only fictional fixture references are accepted");
  const actor=await this.db.sessionActor(auth);
  const recorded=await this.db.inTenant(actor,tenant,async client=>{
    await client.query("SELECT set_config('tto.pcs010_lab','1',true)");
    const r=await client.query<{accepted:boolean}>(
      "SELECT tto.pcs010_record_fixture_review($1,$2) AS accepted",[tenant,fixtureRef]);
    return r.rows[0]?.accepted===true;
  });
  if(!recorded)throw new ForbiddenException("No manager authority, invalid fixture or duplicate");
  return {recorded:true,kind:"SYNTHETIC_ONLY",official:false,canTransfer:false,canTrade:false};
 }
}

/**
 * PH07 bounded, tenant-scoped read models on the real Nest authentication path.
 * Query functions are SECURITY DEFINER with role-based and tenant-based filters;
 * API runs exclusively as tto_app. No raw table access or legal e-voting host.
 */
@Controller("v1/tenants")
export class Ph07PortalController {
 constructor(private readonly db:Database) {}
 private async scoped<T>(tenant:string,auth:string|undefined,run:(client:PoolClient)=>Promise<T>):Promise<T>{
  const actor=await this.db.sessionActor(auth);
  return this.db.inTenant(actor,tenant,run);
 }
 @Get(":tenantId/ph07/communications")
 async communications(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
   @Headers("authorization") auth?:string) {
  return this.scoped(tenant,auth,async c=>{
   const r=await c.query("SELECT publication_id,title,version FROM tto.ph07_my_publications() LIMIT 50");
   return {items:r.rows,source:"PH07_MEMBER_PUBLICATION"};
  });
 }
 @Get(":tenantId/ph07/notices/:publicationId/status")
 async noticeStatus(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
   @Param("publicationId",new ParseUUIDPipe()) publication:string,
   @Headers("authorization") auth?:string){
  return this.scoped(tenant,auth,async c=>{
   const r=await c.query("SELECT delivered,read,acknowledged FROM tto.ph07_my_notice_status($1)",[publication]);
   if(r.rows.length!==1)throw new ForbiddenException({code:"NOTICE_SCOPE_DENIED"});
   return r.rows[0];
  });
 }
 @Get(":tenantId/ph07/support/my-tickets")
 async myTickets(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
   @Headers("authorization") auth?:string){
  return this.scoped(tenant,auth,async c=>{
   const r=await c.query("SELECT ticket_id,status,issue_key FROM tto.ph07_my_support_tickets() LIMIT 50");
   return {items:r.rows};
  });
 }
 @Get(":tenantId/ph07/support/:ticketId/notes")
 async ticketNotes(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
   @Param("ticketId",new ParseUUIDPipe()) ticket:string,
   @Headers("authorization") auth?:string){
  return this.scoped(tenant,auth,async c=>{
   const own=await c.query("SELECT 1 FROM tto.ph07_my_support_tickets() WHERE ticket_id=$1",[ticket]);
   if(!own.rows.length)throw new ForbiddenException({code:"TICKET_SCOPE_DENIED"});
   const r=await c.query("SELECT note_id,body FROM tto.ph07_my_ticket_notes($1) LIMIT 100",[ticket]);
   return {items:r.rows};
  });
 }
 @Get(":tenantId/ph07/support/:ticketId/sensitive-access")
 async sensitive(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
   @Param("ticketId",new ParseUUIDPipe()) ticket:string,
   @Headers("authorization") auth?:string){
  return this.scoped(tenant,auth,async c=>{
   const r=await c.query<{allowed:boolean}>("SELECT tto.ph07_can_view_sensitive_source($1) AS allowed",[ticket]);
   if(r.rows[0]?.allowed!==true)throw new ForbiddenException({code:"JIT_REQUIRED"});
   return {authorized:true,sourceDataReturned:false};
  });
 }
 @Post(":tenantId/ph07/support/:ticketId/resolve")
 async resolve(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
   @Param("ticketId",new ParseUUIDPipe()) ticket:string,
   @Headers("authorization") auth:string|undefined,
   @Body() body:Record<string,unknown>){
  const evidence=requireId(body?.evidenceId);
  return this.scoped(tenant,auth,async c=>{
   const r=await c.query<{approved:boolean}>("SELECT tto.ph07_resolve_ticket($1,$2) AS approved",[ticket,evidence]);
   if(r.rows[0]?.approved!==true)throw new ForbiddenException({code:"SUPPORT_RESOLVE_DENIED"});
   return {resolved:true};
  });
 }
 @Get(":tenantId/ph07/disclosures")
 async disclosures(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
   @Headers("authorization") auth?:string){
  return this.scoped(tenant,auth,async c=>{
   const r=await c.query("SELECT package_id,version_num,report_kind,dividend_state FROM tto.ph07_my_disclosures() LIMIT 50");
   return {items:r.rows,kind:"SOURCE_BACKED_DISCLOSURE_ONLY",accountingEngine:false};
  });
 }
}

/**
 * PH09 source-only API. All operations require a real bearer session, and all
 * DB functions enforce the current tenant and role; no raw table SELECTs as
 * tto_app. No automatic AI rejection, wallet, official governance, or deploy.
 */
@Controller("v1/tenants")
export class Ph09PortalController {
 constructor(private readonly db:Database){}
 private async scoped<T>(tenant:string,auth:string|undefined,fn:(c:PoolClient)=>Promise<T>):Promise<T>{
  const actor=await this.db.sessionActor(auth);
  return this.db.inTenant(actor,tenant,fn);
 }
 @Get(":tenantId/ph09/opportunities")
 async opportunities(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
 @Headers("authorization") auth?:string){
  return this.scoped(tenant,auth,async c=>({items:(await c.query(
   "SELECT opportunity_id,title,deadline FROM tto.ph09_my_open_opportunities()"
  )).rows}));
 }
 @Post(":tenantId/ph09/opportunities/:opportunityId/apply")
 async apply(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
 @Param("opportunityId",new ParseUUIDPipe()) opportunity:string,
 @Headers("authorization") auth?:string){
  return this.scoped(tenant,auth,async c=>{
   const r=await c.query<{allowed:boolean}>("SELECT tto.ph09_apply($1) AS allowed",[opportunity]);
   if(r.rows[0]?.allowed!==true)throw new ForbiddenException({code:"OPPORTUNITY_NOT_ELIGIBLE"});
   return {submitted:true,legalDecision:false};
  });
 }
 @Get(":tenantId/ph09/impact/approved")
 async impact(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
 @Headers("authorization") auth?:string){
  return this.scoped(tenant,auth,async c=>({items:(await c.query(
   "SELECT claim_id,measurement_id,amount FROM tto.ph09_my_approved_impact()"
  )).rows,sourceStatus:"APPROVED_ONLY"}));
 }
 @Get(":tenantId/ph09/grc/cases")
 async cases(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
 @Headers("authorization") auth?:string){
  return this.scoped(tenant,auth,async c=>({items:(await c.query(
   "SELECT case_id,kind,status FROM tto.ph09_my_grc_case_summary()"
  )).rows}));
 }
 @Get(":tenantId/ph09/grc/:caseId/can-finalize")
 async grc(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
 @Param("caseId",new ParseUUIDPipe()) caseId:string,
 @Headers("authorization") auth?:string){
  return this.scoped(tenant,auth,async c=>{
   const r=await c.query<{allowed:boolean}>("SELECT tto.ph09_grc_can_finalize($1) AS allowed",[caseId]);
   return {allowed:r.rows[0]?.allowed===true,decisionIsLegalApproval:false};
  });
 }
 @Get(":tenantId/ph09/network/metrics/:snapshotId")
 async metric(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
 @Param("snapshotId",new ParseUUIDPipe()) snapshot:string,
 @Headers("authorization") auth?:string){
  return this.scoped(tenant,auth,async c=>{
   const r=await c.query<{display_value:string|null,display_label:string}>(
   "SELECT display_value,display_label FROM tto.ph09_metric_display($1,5)",[snapshot]);
   if(r.rows.length!==1)throw new ForbiddenException({code:"METRIC_SCOPE_DENIED"});
   return {value:r.rows[0].display_value,label:r.rows[0].display_label};
  });
 }
 @Get(":tenantId/ph09/data-governance/records")
 async retention(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
 @Headers("authorization") auth?:string){
  return this.scoped(tenant,auth,async c=>({items:(await c.query(
   "SELECT record_id,classification,state FROM tto.ph09_my_retention_summary()"
  )).rows}));
 }
 @Post(":tenantId/ph09/data-governance/records/:recordId/dispose")
 async dispose(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
 @Param("recordId",new ParseUUIDPipe()) record:string,
 @Headers("authorization") auth?:string){
  return this.scoped(tenant,auth,async c=>{
   const r=await c.query<{allowed:boolean}>("SELECT tto.ph09_dispose_record($1) AS allowed",[record]);
   if(r.rows[0]?.allowed!==true)throw new ForbiddenException({code:"RETENTION_OR_LEGAL_HOLD_DENIED"});
   return {disposed:true};
  });
 }
}

/**
 * PH10 gap repair: PH08 source-backed read-only integration into the real
 * authenticated Nest API. No new business operations or automatic approvals.
 * Controller NEVER selects raw private PH08 tables as tto_app.
 */
@Controller("v1/tenants")
export class Ph10Phase08ReadController {
 constructor(private readonly db:Database){}
 private async scoped(tenant:string,authorization:string|undefined,sql:string){
  const actor=await this.db.sessionActor(authorization);
  return this.db.inTenant(actor,tenant,async client=>{
   const r=await client.query(sql);
   return {items:r.rows,tenantScoped:true,readOnly:true};
  });
 }
 @Get(":tenantId/ph08/projects/disclosures")
 async projects(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
  @Headers("authorization") auth?:string){
  return this.scoped(tenant,auth,"SELECT project_id,name FROM tto.ph08_my_project_disclosures()");
 }
 @Get(":tenantId/ph08/voice/open-polls")
 async polls(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
  @Headers("authorization") auth?:string){
  return this.scoped(tenant,auth,"SELECT poll_id,title,deadline FROM tto.ph10_member_open_polls()");
 }
 @Post(":tenantId/ph08/voice/:pollId/respond")
 async respondPoll(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
 @Param("pollId",new ParseUUIDPipe()) poll:string,
 @Headers("authorization") auth:string|undefined,
 @Body() input:Record<string,unknown>){
  // Authenticate before parsing domain fields so anonymous requests fail
  // closed with 401 even when the JSON body is absent or malformed.
  const actor=await this.db.sessionActor(auth);
  const answer=requireText(input?.answer,1,400);
  return this.db.inTenant(actor,tenant,async c=>{
   const r=await c.query<{accepted:boolean}>(
     "SELECT tto.ph10_submit_member_poll($1,$2) AS accepted",[poll,answer]);
   if(r.rows[0]?.accepted!==true)throw new ForbiddenException({code:"POLL_DEADLINE_AUDIENCE_OR_DUPLICATE"});
   return {recorded:true,legalVote:false};
  });
 }
 @Post(":tenantId/ph08/learning/events/:eventId/enroll")
 async enroll(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
 @Param("eventId",new ParseUUIDPipe()) event:string,
 @Headers("authorization") auth?:string){
  const actor=await this.db.sessionActor(auth);
  return this.db.inTenant(actor,tenant,async c=>{
   const r=await c.query<{outcome:string}>(
     "SELECT tto.ph10_enroll_training_event($1) AS outcome",[event]);
   const status=r.rows[0]?.outcome;
   if(status==="DUPLICATE")throw new ConflictException({code:"EVENT_ALREADY_REGISTERED"});
   if(status!=="CONFIRMED"&&status!=="WAITLIST")throw new ForbiddenException({code:"EVENT_OR_ROLE_NOT_ALLOWED"});
   return {registration:status,courseCompleted:false,certificateIssued:false};
  });
 }
 @Post(":tenantId/ph08/benefits/vouchers/:voucherId/redeem")
 async redeem(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
 @Param("voucherId",new ParseUUIDPipe()) voucher:string,
 @Headers("authorization") auth?:string){
  const actor=await this.db.sessionActor(auth);
  return this.db.inTenant(actor,tenant,async c=>{
   const r=await c.query<{redeemed:boolean}>(
     "SELECT tto.ph10_redeem_member_voucher($1) AS redeemed",[voucher]);
   if(r.rows[0]?.redeemed!==true)throw new ForbiddenException({code:"NONCASH_VOUCHER_INVALID_USED_OR_FOREIGN"});
   return {redeemed:true,walletCredit:false,cashTransfer:false};
  });
 }
 @Get(":tenantId/ph08/learning/events")
 async learning(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
  @Headers("authorization") auth?:string){
  return this.scoped(tenant,auth,"SELECT event_id,course_title,capacity,refund_policy_version,registration_state FROM tto.ph10_member_training_events()");
 }
 @Get(":tenantId/ph08/benefits/my-vouchers")
 async benefits(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
  @Headers("authorization") auth?:string){
  return this.scoped(tenant,auth,"SELECT voucher_id,title,expires_at,noncash_units FROM tto.ph10_member_vouchers()");
 }
 @Get(":tenantId/ph08/market/offers")
 async marketplace(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
  @Headers("authorization") auth?:string){
  return this.scoped(tenant,auth,"SELECT offer_id,title,price_snapshot,seller_kind FROM tto.ph10_member_market_offers()");
 }
 // PH08 frozen VOICE-AT-005: source DB function suppresses small cohorts; no raw poll answers.
 @Get(":tenantId/ph08/voice/:pollId/aggregate")
 async pollAggregate(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
  @Param("pollId",new ParseUUIDPipe()) poll:string,
  @Headers("authorization") auth?:string){
  const actor=await this.db.sessionActor(auth);
  return this.db.inTenant(actor,tenant,async c=>{
   const role=await c.query<{allowed:boolean}>("SELECT tto.has_tenant_role($1,'MEMBER') AS allowed",[tenant]);
   if(role.rows[0]?.allowed!==true)throw new ForbiddenException({code:"POLL_AGGREGATE_MEMBER_REQUIRED"});
   const v=await c.query<{count:number|null}>("SELECT tto.ph08_poll_public_count($1) AS count",[poll]);
   const count=v.rows[0]?.count??null;
   return {count,suppressed:count===null,legalResolution:false,tenantScoped:true};
  });
 }
 // PH08 frozen PROJ-AT-003: existing SOURCE PG17 routine is transactional,
 // appends one project event and denies cross-tenant/member/non-evidence writes.
 @Post(":tenantId/ph08/projects/milestones/:milestoneId/complete")
 async completeProjectMilestone(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
  @Param("milestoneId",new ParseUUIDPipe()) milestone:string,
  @Headers("authorization") auth:string|undefined,
  @Body("evidenceId",new ParseUUIDPipe()) evidenceId:string){
  const actor=await this.db.sessionActor(auth);
  return this.db.inTenant(actor,tenant,async c=>{
   const role=await c.query<{allowed:boolean}>("SELECT tto.has_tenant_role($1,'COOPERATIVE_MANAGER') AS allowed",[tenant]);
   if(role.rows[0]?.allowed!==true)throw new ForbiddenException({code:"MILESTONE_MANAGER_REQUIRED"});
   const v=await c.query<{accepted:boolean}>("SELECT tto.ph08_complete_milestone($1,$2) AS accepted",[milestone,evidenceId]);
   if(v.rows[0]?.accepted!==true)throw new ForbiddenException({code:"MILESTONE_SCOPE_OR_DUPLICATE_DENIED"});
   return {completed:true,eventRecorded:true,legalApproval:false};
  });
 }
 // PH08 frozen PROJ-AT-006: version-only optimistic reservation, NO silent
 // field edit/approval or cross-county activity; full update still separate.
 @Post(":tenantId/ph08/projects/:projectId/versions/cas")
 async compareProjectVersion(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
  @Param("projectId",new ParseUUIDPipe()) project:string,
  @Headers("authorization") auth:string|undefined,
  @Body() input:Record<string,unknown>){
  const expected=input?.expectedVersion;
  if(typeof expected!=="number"||!Number.isSafeInteger(expected)||expected<1)
   throw new BadRequestException({code:"PROJECT_VERSION_INVALID"});
  const actor=await this.db.sessionActor(auth);
  return this.db.inTenant(actor,tenant,async c=>{
   const role=await c.query<{allowed:boolean}>("SELECT tto.has_tenant_role($1,'COOPERATIVE_MANAGER') AS allowed",[tenant]);
   if(role.rows[0]?.allowed!==true)throw new ForbiddenException({code:"PROJECT_VERSION_MANAGER_REQUIRED"});
   const v=await c.query<{accepted:boolean}>("SELECT tto.ph08_cas_project($1,$2) AS accepted",[project,expected]);
   if(v.rows[0]?.accepted!==true)throw new ConflictException({code:"PROJECT_VERSION_STALE_OR_INACCESSIBLE"});
   return {versionReserved:true,newVersion:expected+1,fieldsChanged:false,legalApproval:false};
  });
 }
 // PH08 LEARN-AT-003: manager-only vacancy-based waitlist promotion.
 // Existing PG17 security-definer routine serializes the event and candidate.
 @Post(":tenantId/ph08/learning/events/:eventId/waitlist/promote")
 async promoteWaitlist(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
  @Param("eventId",new ParseUUIDPipe()) event:string,
  @Headers("authorization") auth?:string){
  const actor=await this.db.sessionActor(auth);
  return this.db.inTenant(actor,tenant,async c=>{
   const role=await c.query<{allowed:boolean}>("SELECT tto.has_tenant_role($1,'COOPERATIVE_MANAGER') AS allowed",[tenant]);
   if(role.rows[0]?.allowed!==true)throw new ForbiddenException({code:"WAITLIST_MANAGER_REQUIRED"});
   const v=await c.query<{promoted:boolean}>("SELECT tto.ph08_waitlist_promote($1) AS promoted",[event]);
   if(v.rows[0]?.promoted!==true)throw new ForbiddenException({code:"WAITLIST_NO_VERIFIED_VACANCY"});
   return {promoted:true,courseCompleted:false,certificateIssued:false,legalApproval:false};
  });
 }
 // PH08 PROC-AT-005: source-backed eligibility predicate only. This does not
 // grant a procurement role or permission to see sealed bid contents.
 @Get(":tenantId/ph08/procurement/tenders/:tenderId/evaluator-eligibility")
 async evaluateEligibility(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
  @Param("tenderId",new ParseUUIDPipe()) tender:string,
  @Headers("authorization") auth?:string){
  const actor=await this.db.sessionActor(auth);
  return this.db.inTenant(actor,tenant,async c=>{
   const role=await c.query<{allowed:boolean}>("SELECT tto.has_tenant_role($1,'COOPERATIVE_MANAGER') AS allowed",[tenant]);
   if(role.rows[0]?.allowed!==true)throw new ForbiddenException({code:"EVALUATOR_MANAGER_REQUIRED"});
   const v=await c.query<{eligible:boolean}>("SELECT tto.ph08_can_evaluate($1) AS eligible",[tender]);
   return {eligible:v.rows[0]?.eligible===true,legalApproval:false,mayReadSealedBid:false};
  });
 }
 // PH08 LEARN-AT-005: member-only historical read after course retirement.
 @Get(":tenantId/ph08/learning/retired-history")
 async retiredLearning(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
  @Headers("authorization") auth?:string){
  const actor=await this.db.sessionActor(auth);
  return this.db.inTenant(actor,tenant,async c=>{
   const role=await c.query<{allowed:boolean}>("SELECT tto.has_tenant_role($1,'MEMBER') AS allowed",[tenant]);
   if(role.rows[0]?.allowed!==true)throw new ForbiddenException({code:"RETIRED_LEARNING_MEMBER_REQUIRED"});
   const result=await c.query("SELECT event_id,course_title,registration_state FROM tto.ph10_member_retired_training_history()");
   return {items:result.rows,tenantScoped:true,readOnly:true};
  });
 }
 // PH08 MKT-AT-004: visible sponsorship label; NEVER official notice.
 @Get(":tenantId/ph08/market/sponsored-creatives")
 async sponsoredAds(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
  @Headers("authorization") auth?:string){
  const actor=await this.db.sessionActor(auth);
  return this.db.inTenant(actor,tenant,async c=>{
   const role=await c.query<{allowed:boolean}>("SELECT tto.has_tenant_role($1,'MEMBER') AS allowed",[tenant]);
   if(role.rows[0]?.allowed!==true)throw new ForbiddenException({code:"SPONSORED_CREATIVE_MEMBER_REQUIRED"});
   const result=await c.query("SELECT creative_id,caption,sponsored,official_notice FROM tto.ph10_member_sponsored_creatives()");
   return {items:result.rows,tenantScoped:true,readOnly:true};
  });
 }
 // PH08 MKT-AT-001: isolated member supplier INQUIRY. No public offer,
 // seller permission, funds, booking, order, or share-market authority.
 @Post(":tenantId/ph08/market/supplier-proposals")
 async supplierInquiry(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
  @Headers("authorization") auth:string|undefined,
  @Body() input:Record<string,unknown>){
  const description=requireText(input?.description,10,500);
  const actor=await this.db.sessionActor(auth);
  return this.db.inTenant(actor,tenant,async c=>{
   const q=await c.query<{proposal_id:string|null}>(
    "SELECT tto.ph10_submit_supplier_inquiry($1) AS proposal_id",[description]);
   const id=q.rows[0]?.proposal_id;
   if(!id)throw new ForbiddenException({code:"SUPPLIER_INQUIRY_MEMBER_DENIED"});
   return {submitted:true,proposalId:id,publicOfferCreated:false,legalApproval:false};
  });
 }
 // PH08 PROJ-AT-002: county branch status inspection only; NEVER auto-authorize.
 @Get(":tenantId/ph08/projects/branches/:branchId/authority-state")
 async branchAuthority(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
  @Param("branchId",new ParseUUIDPipe()) branch:string,
  @Headers("authorization") auth?:string){
  const actor=await this.db.sessionActor(auth);
  return this.db.inTenant(actor,tenant,async c=>{
   const result=await c.query<{outside_county:boolean;independent_activity_approved:boolean;authority_evidence_present:boolean}>(
    "SELECT outside_county,independent_activity_approved,authority_evidence_present FROM tto.ph10_manager_branch_authority_state($1)",[branch]);
   if(result.rows.length!==1)throw new ForbiddenException({code:"BRANCH_MANAGER_OR_SCOPE_DENIED"});
   const x=result.rows[0];
   return {outsideCounty:x.outside_county,independentActivityApproved:x.independent_activity_approved,
     authorityEvidencePresent:x.authority_evidence_present,automaticApproval:false,legalApproval:false};
  });
 }
 // PH08 VOICE-AT-006: accepted proposal cannot implicitly become a project.
 @Get(":tenantId/ph08/voice/proposals/:proposalId/handoff-state")
 async proposalHandoff(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
  @Param("proposalId",new ParseUUIDPipe()) proposal:string,
  @Headers("authorization") auth?:string){
  const actor=await this.db.sessionActor(auth);
  return this.db.inTenant(actor,tenant,async c=>{
   const result=await c.query<{proposal_status:string;handoff_exists:boolean;target_domain:string|null;legal_resolution:boolean}>(
    "SELECT proposal_status,handoff_exists,target_domain,legal_resolution FROM tto.ph10_manager_proposal_handoff_state($1)",[proposal]);
   if(result.rows.length!==1)throw new ForbiddenException({code:"PROPOSAL_MANAGER_OR_SCOPE_DENIED"});
   const x=result.rows[0];
   return {proposalStatus:x.proposal_status,explicitHandoff:x.handoff_exists,
     targetDomain:x.target_domain,legalResolution:false,automaticProjectCreated:false};
  });
 }
 // PH08 BEN-AT-001: read-only policy prereq; no activation mutation.
 @Get(":tenantId/ph08/benefits/:benefitId/activation-prerequisites")
 async benefitPreflight(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
  @Param("benefitId",new ParseUUIDPipe()) benefit:string,
  @Headers("authorization") auth?:string){
  const actor=await this.db.sessionActor(auth);
  return this.db.inTenant(actor,tenant,async c=>{
   const result=await c.query<{limited:boolean;policy_present:boolean;may_activate:boolean;current_status:string}>(
    "SELECT limited,policy_present,may_activate,current_status FROM tto.ph10_manager_limited_benefit_policy($1)",[benefit]);
   if(result.rows.length!==1)throw new ForbiddenException({code:"BENEFIT_MANAGER_OR_SCOPE_DENIED"});
   const x=result.rows[0];
   return {limited:x.limited,allocationPolicyPresent:x.policy_present,prerequisitesMet:x.may_activate,
     currentStatus:x.current_status,activated:false,legalApproval:false};
  });
 }

 // PH08 MKT-AT-002: cooperative seller snapshot ONLY. No checkout/order/payments.
 @Get(":tenantId/ph08/market/offers/:offerId/checkout-preflight")
 async checkoutPreflight(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
  @Param("offerId",new ParseUUIDPipe()) offer:string,
  @Headers("authorization") auth?:string){
  const actor=await this.db.sessionActor(auth);
  return this.db.inTenant(actor,tenant,async c=>{
   const x=await c.query<{seller_kind:string;price_snapshot:string;published:boolean}>(
    "SELECT seller_kind,price_snapshot,published FROM tto.ph10_member_checkout_preflight($1)",[offer]);
   if(x.rows.length!==1)throw new ForbiddenException({code:"CHECKOUT_SOURCE_OR_ROLE_DENIED"});
   return {sellerKind:x.rows[0].seller_kind,priceSnapshot:x.rows[0].price_snapshot,
    published:x.rows[0].published,sourceVerified:true,orderCreated:false,
    paymentEnabled:false,transactionAuthorized:false,legalApproval:false};
  });
 }
 // PH08 MKT-AT-003: frozen refund policy read ONLY, no funds or authorization.
 @Get(":tenantId/ph08/market/orders/:orderId/refund-policy-preflight")
 async refundPolicyPreflight(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
  @Param("orderId",new ParseUUIDPipe()) order:string,
  @Headers("authorization") auth?:string){
  const actor=await this.db.sessionActor(auth);
  return this.db.inTenant(actor,tenant,async c=>{
   const x=await c.query<{policy_version:string;order_status:string}>(
    "SELECT policy_version,order_status FROM tto.ph10_member_refund_policy_preflight($1)",[order]);
   if(x.rows.length!==1)throw new ForbiddenException({code:"REFUND_SOURCE_OR_ROLE_DENIED"});
   return {policyVersion:x.rows[0].policy_version,orderStatus:x.rows[0].order_status,
    policySnapshotPreserved:true,refundExecuted:false,paymentEnabled:false,
    transactionAuthorized:false,legalApproval:false};
  });
 }
 // PH08 PROC-AT-001: evaluate server-side late bid barrier. No bid accepted.
 @Get(":tenantId/ph08/procurement/tenders/:tenderId/bid-deadline-preflight")
 async bidDeadlinePreflight(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
  @Param("tenderId",new ParseUUIDPipe()) tender:string,
  @Headers("authorization") auth?:string){
  const actor=await this.db.sessionActor(auth);
  return this.db.inTenant(actor,tenant,async c=>{
   const x=await c.query<{deadline_passed:boolean;opened:boolean}>(
    "SELECT deadline_passed,opened FROM tto.ph10_manager_bid_deadline_preflight($1)",[tender]);
   if(x.rows.length!==1)throw new ForbiddenException({code:"BID_DEADLINE_SCOPE_DENIED"});
   return {deadlinePassed:x.rows[0].deadline_passed,opened:x.rows[0].opened,
    bidSubmissionEnabled:false,sealedBidCreated:false,sealedContentExposed:false,
    legalApproval:false};
  });
 }
 // PH08 PROC-AT-003: read criteria lock, not a legal amendment endpoint.
 @Get(":tenantId/ph08/procurement/tenders/:tenderId/criteria-lock-preflight")
 async criteriaLockPreflight(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
  @Param("tenderId",new ParseUUIDPipe()) tender:string,
  @Headers("authorization") auth?:string){
  const actor=await this.db.sessionActor(auth);
  return this.db.inTenant(actor,tenant,async c=>{
   const x=await c.query<{criteria_version:number;opened:boolean;criteria_frozen:boolean}>(
    "SELECT criteria_version,opened,criteria_frozen FROM tto.ph10_manager_criteria_lock_preflight($1)",[tender]);
   if(x.rows.length!==1)throw new ForbiddenException({code:"CRITERIA_LOCK_SCOPE_DENIED"});
   return {criteriaVersion:x.rows[0].criteria_version,opened:x.rows[0].opened,
    criteriaFrozen:x.rows[0].criteria_frozen,criteriaEditEnabled:false,
    newLegalEventCreated:false,legalApproval:false};
  });
 }
 // PH08 PROC-AT-006: only the source-backed policy version series is exposed.
 @Get(":tenantId/ph08/procurement/threshold-policies/:policyCode/version-preflight")
 async thresholdVersionPreflight(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
  @Param("policyCode") policyCode:string,@Headers("authorization") auth?:string){
  if(!/^[A-Z][A-Z0-9_]{2,63}$/.test(policyCode))
   throw new BadRequestException({code:"POLICY_CODE_INVALID"});
  const actor=await this.db.sessionActor(auth);
  return this.db.inTenant(actor,tenant,async c=>{
   const x=await c.query<{policy_version:number;source_ref:string;policy_value:string}>(
    "SELECT policy_version,source_ref,policy_value FROM tto.ph10_manager_threshold_versions_preflight($1)",[policyCode]);
   if(x.rows.length<1)throw new ForbiddenException({code:"THRESHOLD_POLICY_SCOPE_DENIED"});
   const versions=x.rows.map(z=>({version:z.policy_version,sourceRef:z.source_ref,value:z.policy_value}));
   return {policyCode,versions,latestVersion:versions[versions.length-1].version,
    policyMutationEnabled:false,policyAuthorityIssued:false,legalApproval:false};
  });
 }
 @Get(":tenantId/ph08/procurement/tenders")
 async tenders(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
  @Headers("authorization") auth?:string){
  return this.scoped(tenant,auth,"SELECT tender_id,deadline,opened_at,criteria_version FROM tto.ph10_manager_procurement_tenders()");
 }
}

@Module({imports:[DatabaseModule,IdentityModule,TenantPartyModule,DocumentsAuditModule],controllers:[HealthController,FoundationCommandsController,Pcs010FixtureController,Ph07PortalController,Ph09PortalController,Ph10Phase08ReadController],providers:[ApiIrSmsOtpProvider]})
export class AppModule {}
