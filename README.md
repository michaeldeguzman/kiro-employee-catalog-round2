# OutSystems Employee Catalog — REST API Tests

TypeScript + Vitest project for testing OutSystems REST endpoints.

## Project layout

```
.
├── src/
│   └── client.ts          # Reusable OutSystems REST client
├── tests/
│   ├── setup.ts           # Loads .env before each test suite
│   ├── client.test.ts     # Unit tests for the HTTP client (offline)
│   └── employees.test.ts  # Integration tests for Employee endpoints
├── .env.example           # Environment variable template
├── vitest.config.ts
├── tsconfig.json
└── package.json
```

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — set OUTSYSTEMS_BASE_URL and (optionally) OUTSYSTEMS_API_KEY
```

### `.env` values

| Variable | Required | Description |
|---|---|---|
| `OUTSYSTEMS_BASE_URL` | Yes | Base URL of your OutSystems REST API |
| `OUTSYSTEMS_API_KEY` | No | API key sent as `X-API-Key` header |

**Example:**
```
OUTSYSTEMS_BASE_URL=https://your-org.outsystemscloud.com/EmployeeCatalog/rest/EmployeeAPI
OUTSYSTEMS_API_KEY=abc123
```

## Running tests

| Command | Description |
|---|---|
| `npm test` | Run all tests once |
| `npm run test:watch` | Re-run on file changes |
| `npm run test:ui` | Open the Vitest browser UI |
| `npm run test:coverage` | Generate a coverage report |
| `npm run typecheck` | Type-check without running tests |

> Without `OUTSYSTEMS_BASE_URL` set, the integration tests use an in-process
> mock so they still pass in CI without a live OutSystems environment.

## Adding new endpoint tests

1. Create `tests/<feature>.test.ts`.
2. Import `OutSystemsClient` from `../src/client.js`.
3. Define your response type interfaces.
4. Write `describe` / `it` blocks — the global `expect` is available without
   importing (configured via `globals: true` in `vitest.config.ts`).

```ts
import { describe, it, expect } from "vitest";
import { OutSystemsClient } from "../src/client.js";

interface Department { Id: number; Name: string; }

describe("GET /departments", () => {
  it("returns a list", async () => {
    const client = new OutSystemsClient();
    const res = await client.get<Department[]>("/departments");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  });
});
```

## OutSystemsClient API

```ts
const client = new OutSystemsClient(baseUrl?, apiKey?);

client.get<T>(path, options?)
client.post<T>(path, body?, options?)
client.put<T>(path, body?, options?)
client.patch<T>(path, body?, options?)
client.delete<T>(path, options?)
```

All methods return `Promise<ApiResponse<T>>`:

```ts
interface ApiResponse<T> {
  status: number;
  ok: boolean;        // true for 2xx
  data: T;
  headers: Record<string, string>;
}
```

Pass query params via `options.params`:

```ts
client.get("/employees", { params: { page: 1, pageSize: 25 } });
// → GET /employees?page=1&pageSize=25
```
