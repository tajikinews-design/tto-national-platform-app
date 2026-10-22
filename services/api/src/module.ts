import { Module, Global, Controller, Get, Headers, Param, ParseUUIDPipe, Injectable, UnauthorizedException, ForbiddenException } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { createHash } from "node:crypto";

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
@Module({imports:[DatabaseModule,IdentityModule,TenantPartyModule,DocumentsAuditModule],controllers:[HealthController]})
export class AppModule {}
