# Burning Bull Shared Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Ship a real, shared Burning Bull inventory and project app with server-enforced roles, PostgreSQL on Railway, and a Vercel URL.
**Architecture:** React/Vite frontend, Express API, PostgreSQL transactional workspace aggregate. Session and account tables are separate; audit events are append-only. Server is the only writer. User explicitly chose Railway and requested parallel subagents and deployment; proceed without another approval gate.
**Tech Stack:** React 18, TypeScript, Vite 7, Express 5, pg, zod, Node crypto scrypt, tsx, PostgreSQL.
**Spec:** ../specs/2026-11-05-burning-bull-operations-design.md; user amendments: actual auth/shared DB, Railway instead of Firestore, parallel agents.

## Global Constraints
- Preserve source attribution Juanes2424/sisemp_proyecto commit 0a93187.
- Real authentication only, no client role switching, no fake external sends or Siigo claims.
- Small representative inventory sample, no Sheet modifications or live-sync claim.
- Node >=22.12; no credentials committed or printed in routine logs.
- APP_ORIGIN is the public Vercel production origin; frontend requests /api proxied to Railway.

## Review Focus
- Concurrent reservations and double returns must not overallocate stock.
- Forged roles and disabled users must fail at API boundary.
- Expired/reused invitations and sessions must be rejected.
- Edits to dispatched/approved projects must not silently invalidate commitments.
- Public deep links, mobile layout and session expiry must remain usable.

### Task 1: Domain contract and transactional operations (root)
**Files:** src/domains/{shared/types,access/policy,inventory/service,projects/service,procurement/service}.ts, tests/domain.test.ts, server/{app,index,commands}.ts
**Interfaces:** Workspace, User, Command, CommandResult in src/domains/shared/types.ts; applyCommand(workspace, user, command) returns {state,summary}; inventoryCheck(workspace, project), stockSummary(workspace,itemId).
- [x] Write domain tests for overlapping/independent dates, reservations, dispatch requirements, partial/damaged returns, invalid quantities, permissions, quote coverage and locked project edits; run RED.
- [x] Implement pure domain rules, schema validation and Postgres SELECT FOR UPDATE commands; run tests GREEN.
- [x] Integrate API with auth middleware, migration and state/audit endpoints; commit.

### Task 2: Auth and database access (auth subagent)
**Files:** server/db.ts, server/access/**, server/migrations/**, server/migrate.ts, tests/auth.test.ts
**Interfaces:** pool; migrate(); authRouter; requireUser middleware sets res.locals.user: User; createInvitation(...), bootstrap CLI.
- [x] Test password hashing/verification, invitation expiry/reuse, session expiration, role enforcement, account disabling and last manager constraints.
- [x] Implement scrypt hashes, opaque hashed session/invite tokens, invite-only activation, login/logout/password change, SQL rate limiting, members administration and migration. Run tests.
- [x] Commit only owned files and report integration details.

### Task 3: Frontend (frontend subagent)
**Files:** src/app/**, src/components/**, src/pages/**, src/styles.css, src/main.tsx, index.html, docs/DEMO.md
**Interfaces:** GET /api/state -> {state,version,user}; POST /api/commands -> CommandResult; /api/auth/session|login|logout|invitation|activate|password|members|invitations.
- [x] Build real access and invitation UI, dashboard, inventory, projects, reservations, dispatches, returns, procurement, audit/members.
- [x] Use shared contracts and server actions; no localStorage persistence or role selector. Handle errors/loading/session expiry. Browser verify primary flows.
- [x] Commit only owned files.

### Task 4: Infrastructure (infra subagent)
**Files:** railway.json, vercel.json, .gitignore, docs/DEPLOYMENT.md; cloud project creation
**Interfaces:** Railway dedicated project with Postgres + Node API, Vercel static site proxy to Railway; shared repo with branch feat/burning-bull-platform.
- [x] Provision dedicated Railway project/Postgres/API; store connection URLs locally in ignored .secrets/env files without printing values.
- [x] Configure API variables and public domain, Vercel project and rewrites; publish source through personal GitHub fork, preserving attribution.
- [x] Report nonsecret IDs/domains and exact deployment procedure; do not deploy incomplete code.

### Task 5: Integration, verification and release (root)
- [x] Run all domain/auth tests, TypeScript/build, migration on real database, concurrent integration tests and browser tests with temporary users.
- [x] Fresh subagent whole-branch security/correctness review; fix significant findings with regression tests.
- [x] Deploy API and Vercel frontend, verify READY/healthy and unauthenticated API rejection, activation/login, shared changes across users, deep links and mobile.
- [x] Leave a one-time manager activation link for the user; remove test accounts and test data; commit and provide live URL plus exact limitations.
