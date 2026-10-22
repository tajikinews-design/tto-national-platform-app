import { Module, Global, Controller, Get, Headers, Param, ParseUUIDPipe, Injectable, UnauthorizedException, ForbiddenException, Post, Body, BadRequestException, ServiceUnavailableException, HttpCode } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { createHash, createHmac, randomBytes } from "node:crypto";

@Injectable()
export class Database {
  private readonly pool: Pool;
  constructor() {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL_NOT_CONFIGURED");
    this.pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 8, application_name: "tto_api" });
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
  async sessionActor(authorization?: string): Promise<string> {
    const match = /^Bearer ([A-Za-z0-9_-]{32,256})$/.exec(authorization ?? "");
    if (!match) throw new UnauthorizedException("Authentication required");
    const hash = createHash("sha256").update(match[1]).digest("hex");
    const result = await this.pool.query<{user_id:string}>(
      "SELECT user_id FROM tto.resolve_session(decode($1, 'hex'))", [hash]
    );
    if (result.rows.length !== 1) throw new UnauthorizedException("Invalid or expired session");
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
      if (!result.rowCount) throw new ForbiddenException("Tenant context denied");
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
      if(!valid.rowCount) throw new ForbiddenException("Tenant context denied");
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
  @Get("health") status() { return {status:"ok",stage:"CF01-03_FOUNDATION",note:"Not proof of database/tenant health"}; }
}

/** Tenant commands are routed only through verified session -> transaction-local identity context. */
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
  constructor(private readonly db:Database){}
  private async run<T>(tenant:string,auth:string|undefined,sql:string,values:unknown[]):Promise<T>{
    const actor=await this.db.sessionActor(auth);
    return this.db.inTenant(actor,tenant,async c=>{
      const data=await c.query<{out:T}>(sql,values);
      return data.rows[0].out;
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
  @Post("auth/logout")
  @HttpCode(204)
  async logout(@Headers("authorization") auth?:string){
    const actor=await this.db.sessionActor(auth);
    await this.db.withActor(actor,async client=>client.query("SELECT tto.revoke_own_sessions()"));
  }
  @Post("tenants/:tenantId/roles/assign")
  async assign(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
    @Headers("authorization") auth:string|undefined,@Body() input:Record<string,unknown>) {
    const target=requireId(input?.targetId),legal=requireId(input?.legalAuthorityId);
    const role=requireText(input?.roleCode,2,40);
    if(!["MEMBER","COOPERATIVE_MANAGER","DOCUMENT_REVIEWER"].includes(role))
      throw new BadRequestException("Unsupported role");
    const ok=await this.run<boolean>(tenant,auth,"SELECT tto.assign_tenant_role($1,$2,$3,$4) AS out",
      [target,tenant,role,legal]);
    if(!ok)throw new ForbiddenException("Role assignment denied");
    return {assigned:true};
  }
  @Post("tenants/:tenantId/roles/:assignmentId/revoke")
  async revoke(@Param("tenantId",new ParseUUIDPipe()) tenant:string,
    @Param("assignmentId",new ParseUUIDPipe()) assignment:string,
    @Headers("authorization") auth:string|undefined,@Body() input:Record<string,unknown>){
    const version=input?.expectedVersion;
    if(!Number.isSafeInteger(version)||Number(version)<1)
      throw new BadRequestException("Invalid expected version");
    const ok=await this.run<boolean>(tenant,auth,"SELECT tto.revoke_role_assignment($1,$2) AS out",
      [assignment,version]);
    if(!ok)throw new ForbiddenException("Role revocation denied");
    return {revoked:true};
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

@Module({imports:[DatabaseModule,IdentityModule,TenantPartyModule,DocumentsAuditModule],controllers:[HealthController,FoundationCommandsController]})
export class AppModule {}
