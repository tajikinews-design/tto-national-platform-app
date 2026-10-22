# TTO National Cooperative Platform — Application

**Implementation repository**: [tajikinews-design/tto-national-platform-app](https://github.com/tajikinews-design/tto-national-platform-app) · PRIVATE

**Read-only approved originals**: [tajikinews-design/tto-national-platform](https://github.com/tajikinews-design/tto-national-platform) · `main` pinned at `5eb6be8edfbb61f2eca740a42c30f572b493f023` · exactly 15 files. No original Word/Excel/PNG files are replicated here.

## Current status

- Actual application backend/database/auth/business-domain implementation: **NOT STARTED**.
- Three `apps/` surfaces are restored from a previously CI-tested static prototype, for review only. They do not log in, store or modify data, or simulate business success.
- Technology ADR is pending. Current basic HTML/CSS/JS is a **stack-neutral temporary preview**, not the selection of a production frontend framework.
- No Vercel deployment or Production deployment has been performed. **Production target is only ArvanCloud following explicit approval**.

## Repository layout

```text
apps/{shareholder,cooperative-management,national-admin,preview-index}/
packages/ui/assets/              # temporary shared static UI for internal review
packages/{core,domains,contracts}/
services/{api,workers}/
database/
infra/
configs/                      # access/deployment policy docs
scripts/build_preview.py
scripts/check_source_baseline.py
tests/test_bootstrap.py
status/PHASE_GATES.json
docs/source/SOURCE_BASELINE.json
docs/analysis/CHILD_CATALOG.json
docs/plan/{IMPLEMENTATION_PLAN,DECISION_LOG}.md
.github/workflows/foundation-ci.yml
```

## Validate and assemble offline preview

```bash
python3 -m unittest discover -s tests -v
python3 scripts/build_preview.py
# open locally using an isolated static web server only if appropriate
# python3 -m http.server --directory dist 8000
```

Built static routes: `/shareholder/`, `/cooperative-management/`, `/national-admin/`. No route is authenticated; **do not expose these on a public URL**. Protect the entire hosting deployment before making preview URLs available.

## Next engineering decisions

1. Read all 15 originals, complete requirement/permission/entity/commands/tests traceability and resolve formal legal gate ambiguities.
2. Record ADR for runtime stack, tenancy model, infrastructure, storage, API, deployment regions and operational security. Need user approval for non-reversible/security-critical choices.
3. Implement CF-01..CF-05 then domain children 06..23 with real backend, persistent storage, tests, logs and tenant security.
4. Configure approved protected Vercel Preview only after commercial eligibility and auth-gate verified. Never deploy Production outside ArvanCloud and without explicit approval.

All updates via independent branch and PR. **No inference that passing static checks means product functionality is complete.**
