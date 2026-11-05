# Release verification · 5 November 2026

Application: https://burning-bull-sisemp-jhostin.vercel.app

Code deployed: `20846d66bde2595da3f6c4253f66db910939983d`, branch `feat/burning-bull-platform` in [JhostinAleck/sisemp_proyecto](https://github.com/JhostinAleck/sisemp_proyecto/tree/feat/burning-bull-platform). The original Juanes2424 repository was not modified.

- Vercel deployment `dpl_3TWXd3BFJqLBQr1KFyBDVx3EAkPW`: READY, production.
- Railway API deployment `6c178231-5823-4089-8a42-0a0a1720b9ed`: SUCCESS.
- Frontend and proxied database health: HTTP200. Unauthenticated `/api/state`: HTTP401. Unknown API routes: JSON404; frontend deep links: HTML200.
- Full suite:34passed,0failed,0skipped with two dedicated local PostgreSQL databases. TypeScript/Vite build passed. Runtime npm audit:0vulnerabilities.
- Independent review found5significant issues, all corrected with regression tests: immutable submitted/approved pricing, stale procurement after structural edits, submitted quotation edits, ambiguous retry identity and Bogotá business dates.
- Local Chrome browser flows passed: inventory/project/material/reservation/dispatch/partial damaged return/review; supplier/RFQ/offer/selection/costs/submission/approval; approved amount unchanged after later stock receipt; role-based controls; deep links;390px mobile viewport without page overflow; zero JavaScript errors.
- The operations flow also passed against the public Vercel deployment using real temporary accounts. A second isolated browser context authenticated as another user and read the same newly created inventory record from PostgreSQL. Secure session cookies worked across the Vercel proxy.
- Temporary production accounts, sessions, test operations and test audit records were removed. The initial catalogue/project sample was restored; the one-time first-manager invitation remained unused.

The private manager activation link is kept locally in `.secrets/access.json` and `.secrets/GERENCIA.md`, excluded from Git and Railway uploads. Do not publish it. The user chooses their own password. The app sends no invitation emails; Gerencia copies individual one-time links to the intended recipients.

The initial catalogue is a representative sample, not a completed migration or a live Google Sheets integration. No company-user validation meeting is claimed; the group must still perform and document that validation for its course presentation.
