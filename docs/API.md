# API examples

Failures use `{"error":{"code":"...","message":"...","fields":{}}}`. `fields` is present only for validation errors. Status codes: 400 invalid input, 401 missing/expired session, 403 rejected origin/header, 404 missing or another user's record, 409 duplicate/full day, 429 throttled, 500 internal failure.

## Register and log in

```http
POST /api/auth/register
Content-Type: application/json
X-Requested-With: Sweety
Origin: http://localhost:5173

{"name":"Alex","email":"alex@example.com","password":"a-long-demo-password"}
```

Returns 201, `{"user":{"id":"<uuid>","name":"Alex","email":"alex@example.com"}}` and an HttpOnly session cookie. Login uses only email/password at `/auth/login`. Unknown fields are rejected. Logout revokes the current session and returns 204.

## Save a reading

```http
POST /api/readings
Content-Type: application/json
X-Requested-With: Sweety
Cookie: sweety_session=<opaque token>
Origin: http://localhost:5173

{"date":"2026-10-15","slot":"fasting","value":110}
```

Returns 201 and `{"reading":{"id":"<uuid>","date":"2026-10-15","slot":"fasting","value":110}}`.

Slots: `fasting`, `after_breakfast`, `after_lunch`, `after_dinner`. Values are JSON numbers, integer, 40-600 inclusive. PUT accepts the same complete body. DELETE returns 204. All operations use the session user; the body cannot select a user ID.

## Read a report

`GET /api/reports?date=2026-10-15&period=monthly`

```json
{
  "period": "monthly",
  "range": { "start": "2026-09-01", "end": "2026-09-30" },
  "summary": { "count": 2, "highest": 130, "lowest": 90, "average": 110 },
  "readings": [
    { "id": "<uuid>", "date": "2026-09-01", "slot": "fasting", "value": 90 },
    { "id": "<uuid>", "date": "2026-09-30", "slot": "after_lunch", "value": 130 }
  ]
}
```

The frontend formats the average as `110.0`. Empty reports return null aggregates, zero count and an empty reading list. Rows are chronological with slots in meal order. Future selected dates are rejected. Periods are `daily`, `mtd` and `monthly`.

## List readings

`GET /api/readings?from=2026-10-01&to=2026-10-15&page=1&limit=20`

Returns `{"readings":[...],"pagination":{"page":1,"limit":20,"total":42}}`. Both optional date boundaries are inclusive. Order: newest date first, then meal order. Page is 1-based; limit is 1-100. No results means empty readings and total zero.

## Download a report

GET /api/reports/export?date=2026-10-15&period=monthly uses the same authentication, validation and date ranges as the JSON report. It returns text/csv with an attachment filename containing the period and date range. Columns: Date, Time slot, Glucose (mg/dl). UTF-8 BOM and CRLF row endings support spreadsheet applications. No names or emails are exported. An empty range returns only the header; the UI disables empty downloads.
