# Environment separation and release policy

- **Reference GitHub:** `tajikinews-design/tto-national-platform` read-only, 15 original immutable files; do not add any generated artifacts.
- **Application GitHub:** `tajikinews-design/tto-national-platform-app` private; use feature branches, pull requests, no secrets and evidence-gated merges.
- **Preview:** Vercel, only after eligible non-Hobby commercial plan / approved scope, explicit Deployment Protection/SSO setup and verification, synthetic fixtures, isolated non-production data.
- **Production:** ArvanCloud **only**; explicit owner approval required for provision, deploy, promotion, DNS switch, data migration and outbound integrations.
- Never silently connect Vercel to `main` with automatic production deploys. No GitHub Pages public preview.
