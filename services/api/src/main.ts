import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "./module";
async function main() {
  // Fail closed BEFORE Nest starts constructing providers: Nest can terminate
  // during dependency initialization without reaching main().catch().
  // Keep this check aligned with Database's separate guarded Vercel path.
  // Never print DATABASE_URL, passwords, connection strings or raw errors.
  if (!process.env.DATABASE_URL && !process.env.VERCEL) {
    throw Object.assign(new Error("DATABASE_URL_NOT_CONFIGURED"), {
      code: "DATABASE_URL_NOT_CONFIGURED"
    });
  }
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({ trustProxy: false }), { logger: ["error", "warn"] });
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? "3001"), "0.0.0.0");
}
main().catch((error: unknown) => {
  // Never log the database connection string or exception message:
  // driver errors may contain credentials/connection details.
  const maybe = error as {code?:unknown;cause?:{code?:unknown}};
  const raw = maybe?.code ?? maybe?.cause?.code;
  const safeCode = typeof raw === "string" && /^[A-Z0-9_]{2,40}$/.test(raw) ? raw : "UNKNOWN";
  console.error("TTO_API_STARTUP_FAILED_CODE_" + safeCode);
  process.exitCode = 1;
});

// TTO_GIT_PREVIEW_AUTODEPLOY_SMOKE_20261022: harmless TS comment to verify Git-linked Preview deployment.
