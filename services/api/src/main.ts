import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "./module";
async function main() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({ trustProxy: false }), { logger: ["error", "warn", "log"] });
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? "3001"), "0.0.0.0");
}
main().catch(() => {
  console.error("TTO_API_STARTUP_FAILED");
  process.exitCode = 1;
});
