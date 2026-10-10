# Project Context
- **Application**: Employee Catalog Service
- **Platform**: OutSystems (ODC / O11)
- **Harness / Test Tool**: Vitest (or BDDFramework via API triggers)
- **Test Command**: `npm test`
- **Architecture**: Service Actions / REST Endpoints over Core Entities

---

# Use Case Catalog

## Use Case #1: Create Employee Record
**Description**:
An HR user wants to create an employee record with FirstName, LastName, Department, and Email. The system must generate a unique identifier and reject any duplicate email addresses.

**Status**: In Progress
**Current Phase**: Green
**Last Phase Completed**: Green (live-verified against EmployeeCatalogMCP2)
**Last Updated**: 2026-10-10 07:37
**Test Count**: 6 tests (Scenario 1 has 3 tests)
**Test File**: `tests/create-employee.test.ts`
**Last Live Run**: 2026-10-10, against EmployeeCatalogMCP2 (revision 7, latest deployed after the IdxEmail_Unique verification and ASE harness cleanup) on the ODC Development tenant. All 6 Use Case #1 tests passed: S1 (3 tests) 201 + generated Id + echoed fields; S2 duplicate email -> 409 with { Errors, StatusCode } body; S3 missing Email -> 400 with Errors array; S4 empty body -> 400 ODC built-in validation shape. Full suite 20/20: 14 hit the live API, 6 are offline unit tests. IdxEmail_Unique confirmed enforcing via a behavioral soft-delete-then-reinsert test.

> Note: Move to Green only after a live run passes against EmployeeCatalogMCP2. A mock run (OUTSYSTEMS_BASE_URL unset) is not sufficient to claim Green on its own, because it exercises stubbed fetch, not the tenant.

### Scenarios (GWT)

**Scenario 1 — Happy path: create a valid employee**
```gherkin
Given a valid payload with FirstName, LastName, Department, and an Email that is unique to this test run
When POST /employees is called
Then the response status is 201
And the response body contains the generated Id (Long Integer, > 0)
And the response body echoes back FirstName, LastName, Department, and Email
```

**Scenario 2 — Duplicate email rejected**
```gherkin
Given an employee has just been created with a unique email for this test run
When POST /employees is called again with the same email
Then the response status is 409
And the response body contains an error message referencing the duplicate email
```

**Scenario 3 — Missing required field (e.g. Email omitted)**
```gherkin
Given a payload that omits the Email field
When POST /employees is called
Then the response status is 400
And the response body contains { "Errors": [...], "StatusCode": 400 } with an Errors entry naming the missing field
```

**Scenario 4 — Empty request body**
```gherkin
Given a request with no body
When POST /employees is called
Then the response status is 400
And the response body contains { "errors": { "ValidationErrors": ["The request body is missing."] } }
Note: this body is produced by the ODC framework before the action flow runs, so it differs from the Errors/StatusCode shape used by Scenario 3.
```

---

## Use Case #2: Filter Active Employees by Department
**Description**:
Retrieve all active employees belonging to a specific department, ignoring inactive staff.