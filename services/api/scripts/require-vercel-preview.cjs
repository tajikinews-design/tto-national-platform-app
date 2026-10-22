"use strict";

/**
 * TTO preview-first safety gate.
 * Vercel sometimes classifies the FIRST deployment as "production", even if
 * callers specify target preview. Abort dependency install / backend build
 * rather than allow a successful production-scoped artifact/alias.
 * No credentials or project IDs are printed or accessed here.
 */
const vercel = process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);
const target = process.env.VERCEL_ENV;
if (vercel && target !== "preview") {
  process.stderr.write("TTO_PREVIEW_ONLY_BUILD_BLOCKED\n");
  process.exit(44);
}
