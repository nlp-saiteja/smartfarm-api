# GRAD Tasks – SmartFarm API (HW3)

This file documents the _graduate-student–only_ extensions implemented for the SmartFarm API:

- **(a)** Pagination and Advanced Filtering for `GET /api/readings`
- **(b)** Centralized Error Middleware and Timing Report

It explains the approach, edge cases handled, and how to reproduce the behavior with `curl` or Postman.

---

## 1. Pagination & Advanced Filtering – `GET /api/readings`

### 1.1 Approach

The `GET /api/readings` endpoint was extended to support **both pagination and multi-criteria filtering** over the in-memory `readings` array, combined with information from the `sensors` array.

**Supported query parameters (all optional but validated if present):**

- `page` – integer, default `1`, must be `>= 1`
- `limit` – integer, default `10`, must be between `1` and `100`
- `type` – string, one of: `temperature`, `humidity`, `moisture` (via parent sensor type)
- `minValue` – numeric: filter readings where `value >= minValue`
- `maxValue` – numeric: filter readings where `value <= maxValue`
- `from` – ISO 8601 timestamp; filter readings `timestamp >= from`
- `to` – ISO 8601 timestamp; filter readings `timestamp <= to`

**Processing order:**

1. **Validate** query parameters (types, ranges, allowed values).
2. **Apply filters first** to produce a filtered list of readings.
3. **Compute pagination metadata** (`totalItems`, `totalPages`) from the filtered list.
4. **Apply pagination** using `page` and `limit`.
5. Return a standardized response object:

```json
{
  "page": 1,
  "pageSize": 10,
  "totalItems": 47,
  "totalPages": 5,
  "hasNext": true,
  "hasPrev": false,
  "results": [
    /* current page slice of readings */
  ]
}
```

### 1.2 Edge Cases Handled

- **Missing `page` / `limit`:**
  - Default to `page = 1`, `limit = 10` if not specified.
- **Invalid `page`:**
  - Non-integer or `< 1` → `400 Bad Request` with JSON error:
    ```json
    { "error": "page must be an integer greater than or equal to 1" }
    ```
- **Invalid `limit`:**
  - Non-integer, `< 1`, or `> 100` → `400 Bad Request` with JSON error:
    ```json
    { "error": "limit must be between 1 and 100" }
    ```
- **Invalid `type`:**
  - Not in `[temperature, humidity, moisture]` → `400` with:
    ```json
    { "error": "Invalid type: must be one of temperature, humidity, moisture" }
    ```
- **Invalid `minValue` / `maxValue`:**
  - Non-numeric values → `400` with:
    ```json
    { "error": "minValue must be a number" }
    ```
    or
    ```json
    { "error": "maxValue must be a number" }
    ```
- **Inconsistent numeric range (`minValue > maxValue`):**
  - → `400` with:
    ```json
    { "error": "minValue cannot exceed maxValue" }
    ```
- **Invalid `from` / `to` timestamps:**
  - Not parseable as ISO 8601 → `400` with:
    ```json
    { "error": "Invalid date format for 'from' parameter" }
    ```
    or
    ```json
    { "error": "Invalid date format for 'to' parameter" }
    ```
- **`from` later than `to`:**
  - → `400` with:
    ```json
    { "error": "'from' cannot be later than 'to'" }
    ```
- **No results after filtering:**
  - `totalItems = 0`, `totalPages = 0`, `results = []`, with metadata still present.
- **Out-of-range `page` (e.g., `page=999`):**
  - Valid request, but `page > totalPages` → returns **empty `results`** with correct metadata fields.

### 1.3 How to Reproduce (curl Examples)

1. **Basic pagination with defaults:**

   ```bash
   curl "http://localhost:3000/api/readings"
   ```

2. **Explicit pagination:**

   ```bash
   curl "http://localhost:3000/api/readings?page=1&limit=10"
   ```

3. **Filter by type + value range + time window:**

   ```bash
   curl "http://localhost:3000/api/readings?page=1&limit=5&type=temperature&minValue=10&maxValue=40&from=2025-11-01T00:00:00Z&to=2025-11-02T00:00:00Z"
   ```

4. **Out-of-range page (empty results, metadata intact):**

   ```bash
   curl "http://localhost:3000/api/readings?page=999&limit=10"
   ```

5. **Invalid numeric range (400 error):**

   ```bash
   curl "http://localhost:3000/api/readings?minValue=50&maxValue=10"
   ```

6. **Invalid type (400 error):**

   ```bash
   curl "http://localhost:3000/api/readings?type=wrongType"
   ```

7. **Invalid timestamp (400 error):**
   ```bash
   curl "http://localhost:3000/api/readings?from=not-a-date"
   ```

These requests correspond directly to C1–C5 in the pagination/filtering acceptance criteria.

---

## 2. Centralized Error Middleware & Timing

### 2.1 Approach

A **centralized error-handling system** was implemented using Express middleware to standardize error responses and log detailed diagnostics.

The design is composed of:

1. **Request ID + start time middleware** (early in the chain):

   - Adds `req.requestId` (short random string) for correlation.
   - Records `req._startAt` (timestamp in ms) to measure request duration.

2. **Global error handler (last middleware):**

   - Calculates `durationMs = now - req._startAt`.
   - Builds a standardized JSON payload containing:
     ```json
     {
       "timestamp": "...",
       "requestId": "...",
       "path": "/api/some-route",
       "method": "GET",
       "status": 400,
       "message": "Human-readable error message",
       "error": "Same as message"
     }
     ```
   - Logs a structured `ERROR { ... }` object to the console including `durationMs`.
   - Adds `stack` only when `NODE_ENV=development`.

3. **Routes forward errors using `next(err)`:**

   - All validation failures and not-found conditions use a helper:
     ```js
     return next(createError(400, "message"));
     ```
   - A dedicated `/api/fail` route simulates a `500 Internal Server Error` using `next(err)`.

4. **404 fallback middleware:**
   - Any unknown route is turned into a `404` error via `next(createError(404, ...))` and handled centrally.

### 2.2 Diagnostic Fields (C1)

Every error response includes:

- `timestamp` – generated when the error is handled.
- `requestId` – unique ID for this request instance.
- `path` – `req.originalUrl` (exact URL).
- `method` – HTTP method (GET, POST, PUT, DELETE, etc.).
- `status` – HTTP status code (400, 404, 500, ...).
- `message` – human-readable explanation.
- `error` – alias for `message` (for compatibility with earlier requirements).

Example JSON response for a missing sensor:

```json
{
  "timestamp": "2025-11-04T15:30:45.002Z",
  "requestId": "a92f7b",
  "path": "/api/sensors/999",
  "method": "GET",
  "status": 404,
  "message": "Sensor with ID 999 not found",
  "error": "Sensor with ID 999 not found"
}
```

### 2.3 Console Logging & Timing (C2)

The same payload is logged server-side with an additional `durationMs` field:

```text
ERROR {
  timestamp: '2025-11-04T15:30:45.002Z',
  requestId: 'a92f7b',
  path: '/api/sensors/999',
  method: 'GET',
  status: 404,
  message: 'Sensor with ID 999 not found',
  error: 'Sensor with ID 999 not found',
  durationMs: 8
}
```

This satisfies the requirement to capture _when_, _where_, and _how long_ each failed request took.

### 2.4 Error Forwarding via `next(err)` (C3)

A dedicated route illustrates centralized handling:

```js
app.get("/api/fail", (req, res, next) => {
  const err = new Error("Simulated failure");
  err.statusCode = 500;
  err.publicMessage = "Simulated failure";
  next(err);
});
```

This route does not send a response directly. Instead, it relies entirely on the global error handler, which returns a standardized 500 JSON response and logs the error with duration.

Validation errors (e.g., from `GET /api/readings`) and 404s (e.g., missing sensors) use the same pattern, confirming that errors from different parts of the code all flow through the same centralized middleware.

### 2.5 Production vs Development (C4)

- When `NODE_ENV=development`, the error handler adds `payload.stack = err.stack` if available.
- When `NODE_ENV=production`, the `stack` field is omitted, protecting internal details from clients.

This behavior mimics real-world production best practices.

### 2.6 How to Reproduce (curl Examples)

Start the server (example in development mode):

```bash
NODE_ENV=development node index.js
```

Open another terminal to run:

1. **400 – Validation error (invalid query):**

   ```bash
   curl "http://localhost:3000/api/readings?minValue=50&maxValue=10"
   ```

   - Response: HTTP 400 with `"minValue cannot exceed maxValue"`.
   - Terminal: `ERROR { ... status: 400, ..., durationMs: ... }`.

2. **404 – Not found (missing sensor):**

   ```bash
   curl "http://localhost:3000/api/sensors/999"
   ```

   - Response: HTTP 404 with `"Sensor with ID 999 not found"`.
   - Terminal: `ERROR { ... status: 404, ..., durationMs: ... }`.

3. **500 – Simulated failure:**

   ```bash
   curl "http://localhost:3000/api/fail"
   ```

   - Response: HTTP 500 with `"Simulated failure"`.
   - Terminal: `ERROR { ... status: 500, ..., durationMs: ... }`.

4. **Production mode (no stack in response):**
   ```bash
   NODE_ENV=production node index.js
   curl "http://localhost:3000/api/fail"
   ```
   - Response JSON has no `stack` field.
   - Console logs still include full `ERROR { ... }` with `durationMs`.

These examples correspond directly to C1–C5 in the error middleware acceptance criteria.

---

## 3. Summary

The graduate tasks add two production-style features on top of the core SmartFarm API:

1. A robust, validated, and paginated `GET /api/readings` endpoint that supports multiple filters and consistent pagination metadata.
2. A centralized error-handling and logging system with request IDs and timing, offering standardized JSON responses and clear diagnostic logs for 400/404/500 error categories.

Together, these extensions move the SmartFarm backend closer to a real-world Express API used in modern IoT and web applications.
