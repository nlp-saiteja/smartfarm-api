// index.js
// SmartFarm API – HW3 (Web Technologies)
// Node.js + Express backend simulating IoT sensors and readings.
// Includes: CRUD for sensors, nested readings, pagination/filtering, and centralized error handling.

const express = require("express");
const Joi = require("joi");

const app = express();

// ============================================================================
// 1. GLOBAL MIDDLEWARE
// ============================================================================

// Parse JSON request bodies for all incoming requests
app.use(express.json());

// Attach a request ID and start time to each request (for logging & error tracing)
app.use((req, res, next) => {
  // short random ID for each request
  req.requestId = Math.random().toString(36).slice(2, 8);
  // record start time for timing
  req._startAt = Date.now();
  next();
});

// Log method, URL, requestId, duration, and status for every request
app.use((req, res, next) => {
  const start = req._startAt || Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `${req.method} ${req.originalUrl} [${req.requestId}] - ${duration}ms ${res.statusCode}`
    );
  });

  next();
});

// ============================================================================
// 2. IN-MEMORY DATA MODEL
// ============================================================================

// Static list of sensors (simulating DB table "sensors")
const sensors = [
  { id: 1, location: "Field A", type: "temperature", status: "active" },
  { id: 2, location: "Field B", type: "humidity", status: "inactive" }
];

// Static list of readings (simulating DB table "readings")
const readings = [
  { id: 1, sensorId: 1, timestamp: "2025-11-01T10:00:00Z", value: 23.5 },
  { id: 2, sensorId: 1, timestamp: "2025-11-01T11:00:00Z", value: 24.0 }
  // add more readings manually if you want better pagination tests
];

// ============================================================================
// 3. VALIDATION HELPERS (Joi + simple utilities)
// ============================================================================

// Joi schema for validating sensor input in POST/PUT
const sensorSchema = Joi.object({
  location: Joi.string().min(3).required(),
  type: Joi.string().valid("temperature", "humidity", "moisture").required(),
  status: Joi.string().valid("active", "inactive").required()
});

function validateSensor(sensor) {
  return sensorSchema.validate(sensor);
}

// Basic ISO date validation used for readings
function isIsoString(s) {
  return !isNaN(Date.parse(s));
}

// Helper to create standardized Error objects for the global error middleware
function createError(statusCode, publicMessage, internalMessage) {
  const err = new Error(internalMessage || publicMessage);
  err.statusCode = statusCode;
  err.publicMessage = publicMessage;
  return err;
}

// ============================================================================
// 4. CRUD ROUTES FOR SENSORS
//    Base path: /api/sensors
// ============================================================================

// GET /api/sensors
// Optional query: ?status=active | inactive
app.get("/api/sensors", (req, res) => {
  const { status } = req.query;

  if (status) {
    const filtered = sensors.filter(
      (s) => s.status.toLowerCase() === status.toLowerCase()
    );
    return res.send(filtered);
  }

  // If no status filter, return all sensors
  res.send(sensors);
});

// GET /api/sensors/:id
// Returns a single sensor or 404 in standardized error format.
app.get("/api/sensors/:id", (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  const sensor = sensors.find((s) => s.id === id);

  if (!sensor) {
    return next(createError(404, `Sensor with ID ${id} not found`));
  }

  res.send(sensor);
});

// POST /api/sensors
// Creates a new sensor with Joi validation.
app.post("/api/sensors", (req, res, next) => {
  const { error } = validateSensor(req.body);
  if (error) {
    return next(createError(400, error.details[0].message));
  }

  const newId =
    sensors.length > 0 ? Math.max(...sensors.map((s) => s.id)) + 1 : 1;

  const sensor = {
    id: newId,
    location: req.body.location,
    type: req.body.type,
    status: req.body.status
  };

  sensors.push(sensor);
  res.status(201).send(sensor);
});

// PUT /api/sensors/:id
// Updates an existing sensor (404 if not found, 400 if invalid).
app.put("/api/sensors/:id", (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  const sensor = sensors.find((s) => s.id === id);

  if (!sensor) {
    return next(createError(404, `Sensor with ID ${id} not found`));
  }

  const { error } = validateSensor(req.body);
  if (error) {
    return next(createError(400, error.details[0].message));
  }

  sensor.location = req.body.location;
  sensor.type = req.body.type;
  sensor.status = req.body.status;

  res.send(sensor);
});

// DELETE /api/sensors/:id
// Deletes a sensor (404 if not found).
app.delete("/api/sensors/:id", (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  const index = sensors.findIndex((s) => s.id === id);

  if (index === -1) {
    return next(createError(404, `Sensor with ID ${id} not found`));
  }

  const deleted = sensors.splice(index, 1)[0];
  res.send(deleted);
});

// ============================================================================
// 5. NESTED ROUTES FOR READINGS
//    Base path: /api/sensors/:id/readings
// ============================================================================

// GET /api/sensors/:id/readings
// Returns all readings for a given sensor (404 if sensor does not exist).
app.get("/api/sensors/:id/readings", (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  const sensor = sensors.find((s) => s.id === id);

  if (!sensor) {
    return next(createError(404, `Sensor with ID ${id} not found`));
  }

  const sensorReadings = readings.filter((r) => r.sensorId === id);
  res.send(sensorReadings);
});

// POST /api/sensors/:id/readings
// Creates a new reading for a given sensor with simple validation.
app.post("/api/sensors/:id/readings", (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  const sensor = sensors.find((s) => s.id === id);

  if (!sensor) {
    return next(createError(404, `Sensor with ID ${id} not found`));
  }

  const { timestamp, value } = req.body;

  if (!isIsoString(timestamp) || typeof value !== "number") {
    return next(createError(400, "Invalid reading: timestamp or value"));
  }

  const newId =
    readings.length > 0 ? Math.max(...readings.map((r) => r.id)) + 1 : 1;

  const reading = {
    id: newId,
    sensorId: id,
    timestamp,
    value
  };

  readings.push(reading);
  res.status(201).send(reading);
});

// ============================================================================
// 6. PAGINATED + FILTERED READINGS ENDPOINT (GRAD TASK)
//    GET /api/readings?page=&limit=&type=&minValue=&maxValue=&from=&to=
// ============================================================================

app.get("/api/readings", (req, res, next) => {
  let { page, limit, type, minValue, maxValue, from, to } = req.query;

  // ---- 6.1 Pagination defaults + validation ----

  // page: integer >= 1 (default 1)
  if (page === undefined) {
    page = 1;
  } else {
    page = parseInt(page, 10);
    if (Number.isNaN(page) || page < 1) {
      return next(
        createError(
          400,
          "page must be an integer greater than or equal to 1"
        )
      );
    }
  }

  // limit: integer between 1 and 100 (default 10)
  if (limit === undefined) {
    limit = 10;
  } else {
    limit = parseInt(limit, 10);
    if (Number.isNaN(limit) || limit < 1 || limit > 100) {
      return next(createError(400, "limit must be between 1 and 100"));
    }
  }

  // ---- 6.2 Validate filter parameters ----

  // type: if present, must be one of allowed
  const allowedTypes = ["temperature", "humidity", "moisture"];
  if (type && !allowedTypes.includes(type)) {
    return next(
      createError(
        400,
        "Invalid type: must be one of temperature, humidity, moisture"
      )
    );
  }

  // minValue / maxValue: numbers
  let minVal;
  let maxVal;

  if (minValue !== undefined) {
    if (isNaN(Number(minValue))) {
      return next(createError(400, "minValue must be a number"));
    }
    minVal = Number(minValue);
  }

  if (maxValue !== undefined) {
    if (isNaN(Number(maxValue))) {
      return next(createError(400, "maxValue must be a number"));
    }
    maxVal = Number(maxValue);
  }

  if (minVal !== undefined && maxVal !== undefined && minVal > maxVal) {
    return next(createError(400, "minValue cannot exceed maxValue"));
  }

  // from / to: ISO 8601 timestamps
  let fromTime;
  let toTime;

  if (from !== undefined) {
    if (!isIsoString(from)) {
      return next(
        createError(400, "Invalid date format for 'from' parameter")
      );
    }
    fromTime = Date.parse(from);
  }

  if (to !== undefined) {
    if (!isIsoString(to)) {
      return next(
        createError(400, "Invalid date format for 'to' parameter")
      );
    }
    toTime = Date.parse(to);
  }

  if (fromTime !== undefined && toTime !== undefined && fromTime > toTime) {
    return next(createError(400, "'from' cannot be later than 'to'"));
  }

  // ---- 6.3 Apply filters FIRST ----
  let filtered = readings.slice(); // copy

  // type filter (via parent sensor's type)
  if (type) {
    const matchingSensorIds = sensors
      .filter((s) => s.type === type)
      .map((s) => s.id);
    filtered = filtered.filter((r) => matchingSensorIds.includes(r.sensorId));
  }

  // minValue / maxValue filters
  if (minVal !== undefined) {
    filtered = filtered.filter((r) => r.value >= minVal);
  }
  if (maxVal !== undefined) {
    filtered = filtered.filter((r) => r.value <= maxVal);
  }

  // from / to time range filters
  if (fromTime !== undefined) {
    filtered = filtered.filter(
      (r) => Date.parse(r.timestamp) >= fromTime
    );
  }
  if (toTime !== undefined) {
    filtered = filtered.filter(
      (r) => Date.parse(r.timestamp) <= toTime
    );
  }

  // ---- 6.4 Pagination AFTER filtering ----
  const totalItems = filtered.length;
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);

  let results = [];

  if (totalPages === 0 || page > totalPages) {
    // No items or out-of-range page → empty results but valid metadata
    results = [];
  } else {
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    results = filtered.slice(startIndex, endIndex);
  }

  const response = {
    page,
    pageSize: limit,
    totalItems,
    totalPages,
    hasNext: totalPages > 0 && page < totalPages,
    hasPrev: totalPages > 0 && page > 1,
    results
  };

  res.json(response);
});

// ============================================================================
// 7. DEMO ERROR ROUTE (for centralized error handling)
// ============================================================================

// GET /api/fail
// Explicitly triggers a 500 error and forwards it to the global error handler.
app.get("/api/fail", (req, res, next) => {
  const err = new Error("Simulated failure");
  err.statusCode = 500; // Internal Server Error
  err.publicMessage = "Simulated failure";
  next(err); // forward to global error handler
});

// ============================================================================
// 8. 404 FALLBACK FOR UNKNOWN ROUTES
// ============================================================================

app.use((req, res, next) => {
  next(
    createError(
      404,
      `Route ${req.method} ${req.originalUrl} not found`
    )
  );
});

// ============================================================================
// 9. GLOBAL ERROR-HANDLING MIDDLEWARE (MUST BE LAST)
// ============================================================================

app.use((err, req, res, next) => {
  const duration = Date.now() - (req._startAt || Date.now());
  const status = err.statusCode || 500;

  const payload = {
    timestamp: new Date().toISOString(),
    requestId: req.requestId || "unknown",
    path: req.originalUrl,
    method: req.method,
    status: status,
    message:
      err.publicMessage || err.message || "Internal Server Error"
  };

  // Include "error" field as alias for message (helps earlier rubric parts)
  payload.error = payload.message;

  // Server-side structured log with duration
  console.error("ERROR", {
    ...payload,
    durationMs: duration
  });

  // Expose stack only in development
  if (process.env.NODE_ENV === "development" && err.stack) {
    payload.stack = err.stack;
  }

  res.status(status).json(payload);
});

// ============================================================================
// 10. START SERVER
// ============================================================================

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on ${port}...`));
