# Environment and Release Policy — accepted 2026-10-22

- Reference repo: `tajikinews-design/tto-national-platform`, exactly 15 original immutable Word/Excel/PNG files. Never mutate or copy into app repo.
- Implementation repo: `tajikinews-design/tto-national-platform-app`, private, branch/PR/CI gates, no credentials or real PII in Git commits, CI artifacts or logs.
- **Vercel Hobby**: explicitly approved as *internal noncommercial synthetic-data Preview only* subject to real-world Hobby fair-use terms. Hobby alone is not a development blocker. No operational commerce, real payments or real users/PII. Auth-protect the deployment BEFORE sharing URLs; verify logged-out rejection and reviewer access. Set only Preview targets and disable automatic Production branch promotion.
- Vercel may require linked Git integration; account currently has no project/Git namespace. Provisioning/deploy remains pending until such access and protection verified. Check whether compensated development or business-purpose use would exceed Hobby noncommercial rules; escalate concrete mismatch only.
- **Production = ArvanCloud only**. Requires separate explicit owner approval; no provisioning, data transfer, DNS, outbound integrations, branch promotion, or production secrets until authorized. OCI/Docker, SQL and API code must remain portable.
- Source policy and official docs: https://vercel.com/docs/limits/fair-use-guidelines ; https://vercel.com/docs/deployment-protection
