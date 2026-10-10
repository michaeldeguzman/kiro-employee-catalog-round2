# Run Log — EmployeeCatalogMCP2 build via OutSystems MCP

Goal: build a brand new ODC app `EmployeeCatalogMCP2` from `brd-employee-catalog.md` using the OutSystems MCP server, then verify it with the Vitest suite in this repo.

> Note: tenant identifiers, environment/portfolio keys, session/application/publication keys, the live tenant hostname, and the harness shared secret have been redacted with placeholders for publication.

---

## Pre-flight
- auth_status: logged in to the ODC tenant.
- env_list: one environment "Development" (key [ENV_KEY], portfolio [PORTFOLIO_KEY]).
- app_list search "EmployeeCatalogMCP2": 0 results — safe to create.

## Step 1 — Create app + data model (BRD §4), publish revision 1
- mentor_start_session -> sessionId [SESSION_ID].
- mentor_create_asset: EmployeeCatalogMCP2 (WebApplication) -> applicationKey [APP_KEY].
- mentor_prompt (data model): MessageType static entity (Success=1/Error=2/Warning=3/Info=4); EntityActionMessage + EntityActionResult structures; Employee entity with 11 attributes + unique index IdxEmail_Unique on Email. No screens/actions/REST yet.
  - Result: changeApplied=true, errorCount=0, warningCount=2 (Employee scalability best-practice note + EntityActionResult unused — both expected).
- mentor_prompt (publish) -> publishAccepted revision=1, publicationKey [PUBLICATION_KEY].
- publish_status -> Finished, outcome=success, applicationRevision=1.

**STEP 1 RESULT: SUCCESS. EmployeeCatalogMCP2 created, data model published at revision 1.**

## Step 2 — Shared infrastructure actions (BRD §5.1–5.2), publish revision 2
- mentor_prompt: EntityActionResult folder — BuildFromSuccess, BuildFromError, CombineEntityActionMessages (ForEach, newline-joined, severity Error>Warning>Info>Success); Session folder — Session_GetNormalizedSessionUserId (Function=True, returns GetUserId()).
  - Result: changeApplied=true, errorCount=0, warningCount=5 (unused-action notices — expected pre-consumer).
- mentor_prompt (publish) -> publishAccepted + publishSucceeded, revision=2, publicationKey [PUBLICATION_KEY].

**STEP 2 RESULT: SUCCESS. Shared infrastructure published at revision 2.**

## Step 3 — Four Employee actions (BRD §5.3–5.6), publish revision 3
- mentor_prompt: Employee folder — Employee_Validate (6 rules, collect all, Combine on failure, no Build* calls), Employee_Upsert (validate-first, create/update single-Assign paths, BuildFromSuccess, DatabaseException + AllExceptions handlers), Employee_GetCanRemove (GetById aggregate, unsaved/already-removed/ok, DatabaseException raises ProcessingException), Employee_Remove (GetCanRemove guard raises ProcessingException, GetForUpdateEmployee lock, single-Assign soft-delete, UpdateEmployee, handlers).
  - Result: changeApplied=true, errorCount=0, warningCount=3 (unused-action notices — expected pre-REST).
- mentor_prompt (publish) -> publishAccepted + publishSucceeded, revision=3, publicationKey [PUBLICATION_KEY].

**STEP 3 RESULT: SUCCESS. Four Employee actions published at revision 3.**

## Step 4 — EmployeeAPI REST service (BRD §6), publish revision 4
- mentor_prompt: exposed REST API EmployeeAPI with CreateEmployee (POST /employees), ListEmployees (GET /employees, Department filter + paging + TotalCount), GetEmployee (GET /employees/{Id}). Error branches use Response_SetStatusCode + assign body + End (no raise). Structures: CreateEmployeeRequest, CreateEmployeeResponse (6 fields + Errors + StatusCode), EmployeeItem, ListEmployeesResponse.
  - Result: changeApplied=true, errorCount=0, warningCount=2. Mentor fixed a duplicate Start/End node and a TotalCount type conversion during the build.
- mentor_prompt (publish) -> publishAccepted + publishSucceeded, revision=4, publicationKey [PUBLICATION_KEY].
- env_app -> EmployeeCatalogMCP2 revision 4, url [APP_URL].
- mentor_close_session -> closed.

**STEP 4 RESULT: SUCCESS. EmployeeAPI published at revision 4. Full BRD scope (data model + shared infra + 4 Employee actions + 3 REST methods) now live.**

## Verification — live npm test against EmployeeCatalogMCP2 (revision 4)
- OUTSYSTEMS_BASE_URL = [APP_URL]/rest/EmployeeAPI
- `npm test` -> **20 passed, 0 failed (3 files passed).**
  - LIVE-API (14): create-employee.test.ts 6 (S1 x3 201+Id+echo, S2 duplicate 409, S3 missing field 400, S4 empty body 400) + employees.test.ts 8 (GET list/array/fields/pagination, GET by-id, GET 404, POST 201, POST 400).
  - OFFLINE (6): client.test.ts unit tests (stubbed fetch, no tenant).
- Error-contract paths (409/400) returned the custom { Errors, StatusCode } body correctly on the first REST build — no error-handling rework needed.

**BUILD COMPLETE. EmployeeCatalogMCP2 live at revision 4, full suite 20/20 green.**

## Verification — IdxEmail_Unique database index (direct, behavioral)
Model inspection first: context_search (full_fields) on the Employee entity returns all 11 attributes but NO index metadata — the MCP context surface does not expose indexes. So the index was verified behaviorally instead.

Harness setup (to reach Employee_Remove, which the REST API does not expose):
- test_setup_start (app [APP_KEY], env Development) -> setup_id [SETUP_ID], harness revision 5, 13 endpoints. publish_status -> success.

Test (designed to bypass the IsActive=True aggregate in Employee_Validate):
1. POST /employees with a unique email -> HTTP 201, Id 6.
2. exec_in_app Employee_Remove(Id=6) -> IsSuccess=true. Record now IsActive=False (still occupies the email at the DB level).
3. POST /employees with the SAME email -> HTTP 400, body {"Errors":["A database error occurred. Please contact your administrator."]}.
   - The Validate aggregate did NOT catch it (it only sees active rows), so the flow proceeded to CreateEmployee, which hit a DatabaseException on insert. A DatabaseException on a second row with the same email can only come from a unique constraint on Email at the database level.
   - CONCLUSION: IdxEmail_Unique exists and is enforcing. (The 400 vs 500 is cosmetic — Employee_Upsert's DatabaseException handler returns BuildFromError, mapped to 400.)

## Cleanup — remove ASE test harness from deployed app
- First attempt: loaded rev 4 and published -> Mentor publishAutoMerged the harness fork (rev 5) into the base, producing rev 6. Verified via exec_in_app (status ok) that the harness was STILL live on rev 6 — the auto-merge carried it forward.
- Second attempt: mentor_prompt to explicitly delete the harness REST API (12 __ase endpoints), all 13 AseHarness* structures, and the AseUnauthorized exception, keeping EmployeeAPI and all real elements intact. Published revision 7.
- Verified removal directly: exec_in_app against the harness endpoint now returns HTTP 404 (was 200 before cleanup) — endpoints gone, shared secret now inert.
- env_app -> deployed revision 7. npm test -> 20/20 green against the cleaned app.

**FINAL STATE: EmployeeCatalogMCP2 at deployed revision 7, harness removed, IdxEmail_Unique confirmed enforcing, suite 20/20 green.**

---

## Verification — read-only re-check (2026-10-10)

Read-only pass: no files modified, no app changes, no OutSystems MCP/Mentor tools called.

- OUTSYSTEMS_BASE_URL check: set to a real, non-empty, non-placeholder value (value not printed).
- `npm run typecheck` (`tsc --noEmit`): PASSED, exit 0, no errors.

### Live run #1 — 2026-10-10T06:17:30Z (`.env` as-is)
- 2 failed | 18 passed (20). Both failures were client-side Vitest timeouts (`Test timed out in 15000ms`) on the FIRST live request in each file — no HTTP response within the 15s per-test timeout (testTimeout=15000ms). No HTTP error status; later live requests in the same run succeeded.
  - tests/client.test.ts: 6 passed / 0 failed / 0 skipped
  - tests/create-employee.test.ts: 5 passed / 1 failed (S1 "returns status 201") / 0 skipped
  - tests/employees.test.ts: 7 passed / 1 failed (GET /employees "returns a 200 status") / 0 skipped
  - Verbatim summary: `Test Files  2 failed | 1 passed (3)` / `Tests  2 failed | 18 passed (20)` / `Duration  25.76s`

### Live run #2 — 2026-10-10T06:18:14Z (immediate re-run, `.env` as-is)
- 20 passed (20). The run-#1 failures did not reproduce — non-deterministic, consistent with live-tenant cold-start / network latency on the first calls, not a code defect.
  - tests/client.test.ts: 6 / 0 / 0
  - tests/create-employee.test.ts: 6 / 0 / 0
  - tests/employees.test.ts: 8 / 0 / 0
  - Verbatim summary: `Test Files  3 passed (3)` / `Tests  20 passed (20)` / `Duration  4.74s`

### Offline run — 2026-10-10T06:18:34Z (`OUTSYSTEMS_BASE_URL=""`)
- 20 passed (20), mocked fetch, no tenant contact.
  - tests/client.test.ts: 6 / 0 / 0
  - tests/create-employee.test.ts: 6 / 0 / 0
  - tests/employees.test.ts: 8 / 0 / 0
  - Verbatim summary: `Test Files  3 passed (3)` / `Tests  20 passed (20)` / `Duration  175ms`

Live total: 20 (run #2); 18/20 on run #1 due to the two first-call timeouts. Offline total: 20. Skipped: 0 in every run. Live-only in effect: the 14 tests in create-employee.test.ts (6) + employees.test.ts (8) hit the live tenant; the 6 in client.test.ts are always offline unit tests. (No test is hard-gated to live-only — the two suites fall back to a mocked fetch when OUTSYSTEMS_BASE_URL is unset.)

**RE-CHECK RESULT: typecheck clean; offline 20/20; live 20/20 on re-run after a transient first-call timeout on run #1.**
