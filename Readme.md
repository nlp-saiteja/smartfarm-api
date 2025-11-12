# SmartFarm API - Express.js (HW3)

# Name: Leela Phanidhar Sai Teja Nalanagula

# Banner ID: 001304595

## Overview

This project implements a RESTful API for managing IoT sensors and their environmental readings.
It demonstrates Express.js fundamentals, CRUD operations, middleware, input validation with Joi,
query filtering, pagination, and centralized error handling. Designed for graduate-level coursework in Web Technologies.

---

## 1. Installation & Setup

### Prerequisites

- Node.js (v18+ recommended)
- npm (comes with Node)

### Steps

1. Clone or download this project folder.
2. Open the terminal inside the folder.
3. Install dependencies:
   ```bash
   npm install express joi
   ```
4. Run the development server:
   ```bash
   node index.js
   ```
5. The API will start on:
   ```
   http://localhost:3000
   ```
6. (Optional) To run in production mode:
   ```bash
   NODE_ENV=production node index.js
   ```

---

## ⚙️ 2. Environment Variables

- `PORT`: Defaults to **3000** if not provided.
- `NODE_ENV`: Can be set to `development` (shows stack traces) or `production` (hides stack traces).

Example:

```bash
PORT=4000 NODE_ENV=development node index.js
```

---

## 3. Endpoints Implemented

### 3.1 Sensors CRUD (`/api/sensors`)

| Method | Endpoint           | Description                                                         |
| ------ | ------------------ | ------------------------------------------------------------------- |
| GET    | `/api/sensors`     | Retrieve all sensors or filter by `status` (e.g., `?status=active`) |
| GET    | `/api/sensors/:id` | Retrieve one sensor by ID                                           |
| POST   | `/api/sensors`     | Create new sensor (validated by Joi)                                |
| PUT    | `/api/sensors/:id` | Update existing sensor (validated by Joi)                           |
| DELETE | `/api/sensors/:id` | Delete a sensor by ID                                               |

#### Example Request (POST)

```bash
curl -X POST "http://localhost:3000/api/sensors"   -H "Content-Type: application/json"   -d '{"location": "Field A", "type": "temperature", "status": "active"}'
```

#### Example Response

```json
{
  "id": 3,
  "location": "Field A",
  "type": "temperature",
  "status": "active"
}
```

---

### 3.2 Nested Routes for Readings (`/api/sensors/:id/readings`)

| Method | Endpoint                    | Description                                |
| ------ | --------------------------- | ------------------------------------------ |
| GET    | `/api/sensors/:id/readings` | List readings for a sensor                 |
| POST   | `/api/sensors/:id/readings` | Add a reading with `timestamp` and `value` |

#### Example Request (POST)

```bash
curl -X POST "http://localhost:3000/api/sensors/1/readings"   -H "Content-Type: application/json"   -d '{"timestamp": "2025-11-01T10:00:00Z", "value": 22.4}'
```

---

### 3.3 Advanced Filtering & Pagination (`/api/readings`)

Supports pagination and query filters:

| Query Parameter         | Type     | Description                                                            |
| ----------------------- | -------- | ---------------------------------------------------------------------- |
| `page`                  | Integer  | Page number (default: 1)                                               |
| `limit`                 | Integer  | Page size (default: 10, max: 100)                                      |
| `type`                  | String   | Filter readings by sensor type (`temperature`, `humidity`, `moisture`) |
| `minValue` / `maxValue` | Number   | Filter by numeric range                                                |
| `from` / `to`           | ISO 8601 | Filter by timestamp range                                              |

#### Example Request

```bash
curl "http://localhost:3000/api/readings?page=1&limit=5&type=temperature&minValue=10&maxValue=40"
```

#### Example Response

```json
{
  "page": 1,
  "pageSize": 5,
  "totalItems": 47,
  "totalPages": 10,
  "hasNext": true,
  "hasPrev": false,
  "results": [ ... ]
}
```

---

### 3.4 Error Demonstration Routes

| Endpoint                              | Description                                                     |
| ------------------------------------- | --------------------------------------------------------------- |
| `/api/fail`                           | Simulates a 500 error to demonstrate centralized error handling |
| Invalid routes (e.g., `/api/unknown`) | Returns a structured 404 JSON error                             |

#### Example Response (Error)

```json
{
  "timestamp": "2025-11-04T15:30:45.002Z",
  "requestId": "a92f7b",
  "path": "/api/sensors/999",
  "method": "GET",
  "status": 404,
  "message": "Sensor with ID 999 not found"
}
```

---

## 4. Validation (Joi)

Input validation for `POST` and `PUT` on `/api/sensors` ensures that all payloads meet schema rules:

```js
{
  location: Joi.string().min(3).required(),
  type: Joi.string().valid("temperature", "humidity", "moisture").required(),
  status: Joi.string().valid("active", "inactive").required()
}
```

Invalid payloads automatically return HTTP 400 with descriptive messages such as:

```
"location" length must be at least 3 characters long
```

---

## 5. Middleware & Logging

Custom middleware adds request IDs, tracks timing, and logs requests:

Example log output:

```
GET /api/sensors [x1a9bz] - 5ms 200
POST /api/sensors [u9j3la] - 8ms 201
```

---

## 6. Centralized Error Handling

All routes forward errors to a single global error middleware that standardizes JSON output:

Example log:

```
ERROR {
  timestamp: '2025-11-04T17:12:40.501Z',
  requestId: 'b2f5d1',
  path: '/api/fail',
  method: 'GET',
  status: 500,
  message: 'Simulated failure',
  durationMs: 6
}
```

In `NODE_ENV=development`, stack traces are included. In `production`, they are hidden.

---

## 7. Testing the API with curl

**Example:**

```bash
curl -X GET "http://localhost:3000/api/sensors"
curl -X GET "http://localhost:3000/api/sensors/1"
curl -X POST "http://localhost:3000/api/sensors" -H "Content-Type: application/json" -d '{"location":"Field C","type":"humidity","status":"active"}'
curl -X PUT "http://localhost:3000/api/sensors/1" -H "Content-Type: application/json" -d '{"location":"Field A-East","type":"temperature","status":"inactive"}'
curl -X DELETE "http://localhost:3000/api/sensors/2"
```

---

## 8. Directory Structure

```
smartfarm-api/
│
├── index.js              # Main Express server file
├── package.json          # npm dependencies and scripts
└── README.md             # Documentation file (this file)
```

---
