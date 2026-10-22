import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "./module";
async function main() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({ trustProxy: false }), { logger: ["error", "warn", "log"] });
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
