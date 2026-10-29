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
  "apps/shareholder/app/review/interactive/nav-02/synthetic-membership-holdings.tsx",
  "apps/shareholder/app/review/interactive/nav-03/page.tsx",
  "apps/shareholder/app/review/interactive/nav-03/synthetic-share-market.tsx",
  "apps/shareholder/app/review/interactive/nav-03/case-demo/page.tsx",
  "apps/shareholder/app/review/interactive/nav-03/case-demo/synthetic-trade-case.tsx",
  "apps/shareholder/app/review/interactive/nav-03/case-demo/case-fixtures.ts",
  "apps/shareholder/app/review/interactive/nav-04/page.tsx",
  "apps/shareholder/app/review/interactive/nav-04/synthetic-assemblies.tsx",
  "apps/shareholder/app/review/interactive/nav-04/assembly-fixtures.ts",
  "apps/shareholder/app/review/interactive/nav-05/page.tsx",
  "apps/shareholder/app/review/interactive/nav-05/synthetic-communications.tsx",
  "apps/shareholder/app/review/interactive/nav-05/communications-fixtures.ts",
  "apps/shareholder/app/review/interactive/nav-06/page.tsx",
  "apps/shareholder/app/review/interactive/nav-06/synthetic-services.tsx",
  "apps/shareholder/app/review/interactive/nav-06/services-fixtures.ts",
  "apps/shareholder/app/review/interactive/nav-07/page.tsx",
  "apps/shareholder/app/review/interactive/nav-07/synthetic-marketplace.tsx",
  "apps/shareholder/app/review/interactive/nav-07/market-fixtures.ts",
  "apps/shareholder/app/review/interactive/nav-08/page.tsx",
  "apps/shareholder/app/review/interactive/nav-08/synthetic-projects.tsx",
  "apps/shareholder/app/review/interactive/nav-08/project-fixtures.ts",
  "apps/shareholder/app/review/interactive/nav-09/page.tsx",
  "apps/shareholder/app/review/interactive/nav-09/synthetic-disclosures.tsx",
  "apps/shareholder/app/review/interactive/nav-09/disclosure-fixtures.ts",
  "apps/shareholder/app/review/interactive/nav-10/page.tsx",
  "apps/shareholder/app/review/interactive/nav-10/synthetic-reports.tsx",
  "apps/shareholder/app/review/interactive/nav-10/report-fixtures.ts",
  "apps/shareholder/app/review/interactive/nav-11/page.tsx",
  "apps/shareholder/app/review/interactive/nav-11/synthetic-settings.tsx",
  "apps/shareholder/app/review/interactive/nav-11/settings-fixtures.ts"
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
