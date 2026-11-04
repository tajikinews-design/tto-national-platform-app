import { Module, Global, Controller, Get, Headers, Param, ParseUUIDPipe, Injectable, UnauthorizedException, ForbiddenException, Post, Body, BadRequestException, ServiceUnavailableException, ConflictException, HttpCode, Req } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { createHash, createHmac, randomBytes, randomUUID, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { ApiIrSmsOtpProvider } from "./apiir-provider";

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
  const answer=requireText(input?.answer,1,400);
  const actor=await this.db.sessionActor(auth);
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
 @Get(":tenantId/ph08/procurement/tenders")
 async tenders(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
  @Headers("authorization") auth?:string){
  return this.scoped(tenant,auth,"SELECT tender_id,deadline,opened_at,criteria_version FROM tto.ph10_manager_procurement_tenders()");
 }
}

@Module({imports:[DatabaseModule,IdentityModule,TenantPartyModule,DocumentsAuditModule],controllers:[HealthController,FoundationCommandsController,Pcs010FixtureController,Ph07PortalController,Ph09PortalController,Ph10Phase08ReadController],providers:[ApiIrSmsOtpProvider]})
export class AppModule {}
