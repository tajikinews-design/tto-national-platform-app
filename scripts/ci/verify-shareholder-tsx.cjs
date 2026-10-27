"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");

// Resolve TypeScript from its explicitly declared @tto/ui dependency, not
// accidentally from a global or transitive hoist.
const root = path.resolve(__dirname, "../..");
const uiRequire = createRequire(path.join(root, "packages/ui/package.json"));
const ts = uiRequire("typescript");
const files = [
  "packages/ui/src/shareholder-workspace.tsx",
  "packages/ui/src/shareholder-read-models.tsx",
  "packages/ui/src/otp-login.tsx",
  "packages/ui/src/index.tsx",
  "apps/shareholder/app/page.tsx",
  "apps/shareholder/app/modules/[id]/page.tsx",
  "apps/shareholder/app/review/review-portal.tsx",
  "apps/shareholder/app/review/layout.tsx",
  "apps/shareholder/app/review/page.tsx",
  "apps/shareholder/app/review/[id]/page.tsx",
  "apps/shareholder/app/review/interactive/page.tsx",
  "apps/shareholder/app/review/interactive/synthetic-dashboard.tsx",
  "apps/shareholder/app/review/interactive/nav-02/page.tsx",
  "apps/shareholder/app/review/interactive/nav-02/synthetic-membership-holdings.tsx"
];
for (const relative of files) {
  const file = path.join(root, relative);
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  if (source.parseDiagnostics.length) {
    for (const d of source.parseDiagnostics) {
      const location = source.getLineAndCharacterOfPosition(d.start ?? 0);
      console.error("TSX_PARSE_ERROR", relative,
        location.line + 1, location.character + 1,
        ts.flattenDiagnosticMessageText(d.messageText, " "));
    }
    process.exitCode = 1;
    break;
  }
}
if (!process.exitCode) console.log("TTO_SHAREHOLDER_TSX_PARSE_PASS");
