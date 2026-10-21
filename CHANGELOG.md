# Changelog

## [1.31.0-alpha] — 2026-10-21

### P-1: Production domain cutover (zeendeefood.solutions) + infrastructure hardening

#### Changed — domain
- Completed the `deeztechnology.solutions` → `zeendeefood.solutions` move: web `metadataBase`, branding defaults (web + API), pricing contact (`nkuku@zeendeefood.solutions`), README, AGENTS.md, DEPLOYMENT_CHECKLIST, OAuth docs.
- Rebuilt and redeployed prod `api`/`web` images; OG metadata now resolves to the new domain.

#### Added — infrastructure & security
- `ntfy.zeendeefood.solutions` is live end-to-end: GoDaddy DNS A record, ISPConfig site (id 16), Let's Encrypt cert.
- **ntfy access control enabled** (`auth-default-access: deny-all`): anonymous publish to any topic now returns 403; anonymous read kept on `nkuku-alerts` for mobile SSE; API publishes via `NTFY_AUTH_TOKEN` bearer token.
- Security headers on both production vhosts: HSTS, CSP (frame-ancestors 'none'), X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
- `infra/ispconfig/nginx-directives.conf` corrected: removed `upstream` blocks (illegal in ISPConfig server context — had caused a silent rollback of the previous update).

#### Fixed
- `BroilerFlock` web type: added `sold` status + `soldDate` (unblocks `next build` typecheck).
- `bulk-operations` integration test used nonexistent `alertType: 'custom'` → `'environmental'`.
- `pnpm-lock.yaml` regenerated — now covers `apps/web` (fixes frozen-lockfile installs).

#### Security / dependencies
- `fastify` 5.12.7, `nodemailer` 10.1.7 (bundled types; dropped `@types/nodemailer`), `@fastify/swagger-ui` 6.1.2, `mammoth` 1.13.0.
- pnpm overrides: `brace-expansion` (per-major pinned to patched), `fast-uri` ≥4.1.5, `postcss-selector-parser` ≥7.1.6, `source-map-js` ≥1.2.2.
- Residual (no fix published): `braces` (build-time DoS), `sprintf-js` via mammoth.
- `AGENTS.md` documents the GoDaddy/ISPConfig helper paths for future infra work.

#### Validation
- API: lint clean, typecheck clean, unit 56/56, integration 274/274 (fresh Postgres, seeded + migration data).
- Web: lint warnings only, `tsc` clean, production `next build` green in image.
- Mobile: `flutter analyze` 0 errors, 55/55 tests; release APK `nkuku-companion-v1.31.0-alpha` pending rebuild.
- Live: `/health` 200, `/api/v1/billing/plans` 200, ntfy publish→SSE verified, TLS valid to Jan 2027 both hosts.

#### Repo hygiene (in `638d02d`)
- 8 `.bak-premove` files removed; stray `{apps/` dir removed; 14 plan docs → `docs/plans/`; APKs archived to `~/DevWorkz/nkuku-releases/` (removed ~300 MB of tracked binaries).
