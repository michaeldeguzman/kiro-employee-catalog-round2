/**
 * Use Case #1: Create Employee Record
 *
 * RED phase — these tests are written against the expected API contract.
 * They will fail until the OutSystems endpoint is implemented to spec.
 *
 * Scenarios covered:
 *   S1 — Happy path: valid payload → 201 + generated Id
 *   S2 — Duplicate email → 409
 *   S3 — Missing required field → 400
 *   S4 — Empty request body → 400 with OutSystems built-in error shape
 *
 * Run: npm test
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { OutSystemsClient } from "../src/client.js";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CreateEmployeeRequest {
  FirstName: string;
  LastName: string;
  Department: string;
  Email: string;
}

interface CreateEmployeeResponse {
  Id: number;
  FirstName: string;
  LastName: string;
  Department: string;
  Email: string;
}

/** Custom error shape returned by the EmployeeAPI action (409 / app-level 400). */
interface OutSystemsErrorResponse {
  Errors: string[];
  StatusCode: number;
}

/**
 * ODC framework-level validation error shape. Returned by the platform's
 * built-in request validation (e.g. missing body) BEFORE the action flow runs,
 * so it does not use our custom { Errors, StatusCode } shape.
 */
interface OdcValidationErrorResponse {
  errors: { ValidationErrors?: string[] } & Record<string, string[]>;
  title: string;
  status: number;
}

/**
 * Recognisable prefix for every email this suite creates, so test-generated
 * records can be filtered/cleaned up later in the tenant.
 */
const TEST_EMAIL_PREFIX = "kiro-test";

/**
 * Unique email per test run so the live create path returns 201 instead of 409
 * on repeated runs. All test emails share TEST_EMAIL_PREFIX for easy filtering.
 */
function uniqueEmail(label = "s1"): string {
  return `${TEST_EMAIL_PREFIX}+${label}.${Date.now()}.${Math.floor(
    Math.random() * 1e6
  )}@example.com`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns a live client when OUTSYSTEMS_BASE_URL is set, otherwise a client
 * with a stubbed fetch so the suite stays green in CI without a live server.
 */
function makeClient() {
  if (process.env.OUTSYSTEMS_BASE_URL) {
    return new OutSystemsClient();
  }
  vi.stubGlobal("fetch", vi.fn());
  return new OutSystemsClient("https://mock.outsystems.example");
}

function isMock() {
  return !process.env.OUTSYSTEMS_BASE_URL;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Use Case #1 — Create Employee Record", () => {
  let client: OutSystemsClient;

  beforeAll(() => {
    client = makeClient();
  });

  afterEach(() => {
    if (isMock()) {
      vi.mocked(fetch).mockReset();
    }
  });

  // ── S1: Happy path ────────────────────────────────────────────────────────

  describe("S1 — given a valid payload, when POST /employees, then 201 with generated Id", () => {
    // Build a fresh payload with a unique email for each test so the live create
    // path returns 201 rather than 409 on repeated runs.
    function validPayload(): CreateEmployeeRequest {
      return {
        FirstName: "Alice",
        LastName: "Example",
        Department: "Engineering",
        Email: uniqueEmail("s1"),
      };
    }

    it("returns status 201", async () => {
      const payload = validPayload();

      if (isMock()) {
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          status: 201,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({
            Id: 1,
            ...payload,
          } satisfies CreateEmployeeResponse),
          text: async () => "",
        } as unknown as Response);
      }

      const res = await client.post("/employees", payload);
      expect(res.status).toBe(201);
    });

    it("returns a server-generated Id greater than 0", async () => {
      const payload = validPayload();

      if (isMock()) {
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          status: 201,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({
            Id: 42,
            ...payload,
          } satisfies CreateEmployeeResponse),
          text: async () => "",
        } as unknown as Response);
      }

      const res = await client.post<CreateEmployeeResponse>("/employees", payload);
      expect(res.data.Id).toBeDefined();
      expect(typeof res.data.Id).toBe("number");
      expect(res.data.Id).toBeGreaterThan(0);
    });

    it("echoes back FirstName, LastName, Department, and Email", async () => {
      const payload = validPayload();

      if (isMock()) {
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          status: 201,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({ Id: 1, ...payload } satisfies CreateEmployeeResponse),
          text: async () => "",
        } as unknown as Response);
      }

      const res = await client.post<CreateEmployeeResponse>("/employees", payload);
      expect(res.data.FirstName).toBe(payload.FirstName);
      expect(res.data.LastName).toBe(payload.LastName);
      expect(res.data.Department).toBe(payload.Department);
      expect(res.data.Email).toBe(payload.Email);
    });
  });

  // ── S2: Duplicate email ───────────────────────────────────────────────────

  describe("S2 — given a duplicate email, when POST /employees, then 409", () => {
    it("creates an employee, then rejects a second POST with the same email (409)", async () => {
      // Self-seeding: this test does NOT rely on any record already existing in
      // the tenant. It first creates an employee with an email unique to this run,
      // then posts the SAME email again and expects a 409 duplicate rejection.
      const email = uniqueEmail("s2");

      const first: CreateEmployeeRequest = {
        FirstName: "Bob",
        LastName: "Original",
        Department: "HR",
        Email: email,
      };
      const duplicate: CreateEmployeeRequest = {
        FirstName: "Bob",
        LastName: "Duplicate",
        Department: "HR",
        Email: email, // same email as the record just created
      };

      // Step 1 — create the first record (expect 201).
      if (isMock()) {
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          status: 201,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({ Id: 1, ...first } satisfies CreateEmployeeResponse),
          text: async () => "",
        } as unknown as Response);
      }

      const createRes = await client.post<CreateEmployeeResponse>("/employees", first);
      expect(createRes.status).toBe(201);

      // Step 2 — post the same email again (expect 409 duplicate).
      if (isMock()) {
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: false,
          status: 409,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({
            Errors: [`An employee with email '${email}' already exists.`],
            StatusCode: 409,
          } satisfies OutSystemsErrorResponse),
          text: async () => "",
        } as unknown as Response);
      }

      const res = await client.post<OutSystemsErrorResponse>("/employees", duplicate);
      expect(res.status).toBe(409);
      expect(res.ok).toBe(false);
      expect(res.data.Errors).toBeDefined();
      expect(res.data.Errors.length).toBeGreaterThan(0);
      // Error message should reference the duplicate email.
      expect(res.data.Errors[0]).toContain(email);
    });
  });

  // ── S3: Missing required field ────────────────────────────────────────────

  describe("S3 — given a payload missing Email, when POST /employees, then 400", () => {
    it("returns status 400 with an Errors array", async () => {
      const missingEmail = {
        FirstName: "Charlie",
        LastName: "Tester",
        Department: "QA",
        // Email deliberately omitted
      };

      if (isMock()) {
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: false,
          status: 400,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({
            Errors: ["The 'Email' field is required."],
            StatusCode: 400,
          } satisfies OutSystemsErrorResponse),
          text: async () => "",
        } as unknown as Response);
      }

      const res = await client.post<OutSystemsErrorResponse>("/employees", missingEmail);
      expect(res.status).toBe(400);
      expect(res.ok).toBe(false);
      expect(Array.isArray(res.data.Errors)).toBe(true);
      expect(res.data.Errors.length).toBeGreaterThan(0);
    });
  });

  // ── S4: Empty request body ────────────────────────────────────────────────

  describe("S4 — given no request body, when POST /employees, then 400 with OutSystems error shape", () => {
    it("returns status 400 with the ODC built-in missing-body validation error", async () => {
      if (isMock()) {
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: false,
          status: 400,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({
            errors: { ValidationErrors: ["The request body is missing."] },
            title: "One or more validation errors occurred.",
            status: 400,
          } satisfies OdcValidationErrorResponse),
          text: async () => "",
        } as unknown as Response);
      }

      // Pass undefined body. ODC's framework-level request validation rejects it
      // BEFORE the action flow runs, returning the platform's built-in error shape
      // ({ errors: { ValidationErrors: [...] }, ... }) rather than our custom shape.
      const res = await client.post<OdcValidationErrorResponse>("/employees", undefined);
      expect(res.status).toBe(400);
      expect(res.ok).toBe(false);
      expect(res.data.errors.ValidationErrors).toContain("The request body is missing.");
      expect(res.data.status).toBe(400);
    });
  });
});
