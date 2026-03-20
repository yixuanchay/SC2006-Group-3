# HomeMatch

HomeMatch is a web application that helps Singapore home buyers compare HDB/BTO options based on affordability, grant eligibility, and location preferences.

The project is split into:

- A static frontend in `frontend/` built with HTML, CSS, and vanilla JavaScript
- An Express.js backend in `backend/` for authentication, grant calculations, affordability checks, saved searches, and town recommendations
- A MySQL schema in `backend/sql/schema.sql`

## Features

- Landing page, onboarding form, results page, and user dashboard
- Client-side HDB eligibility and grant previews
- Grant calculation for EHG, Family Grant, Singles Grant, Half-Housing Grant, Step-Up Grant, and PHG
- Affordability estimates including downpayment, loan amount, MSR, and TDSR-style checks
- JWT-based authentication and saved searches
- Recommendation backend that combines:
  - live resale price data from `data.gov.sg`
  - commute geocoding/routing via OneMap
  - weighted town scoring heuristics

## Tech Stack

- Frontend: HTML, CSS, vanilla JavaScript
- Backend: Node.js, Express
- Database: MySQL
- Auth: JWT + bcrypt
- Email: Nodemailer
- External APIs:
  - `data.gov.sg` for resale transaction data
  - `OneMap` for geocoding and routing

## Project Structure

```text
.
├── frontend/
│   ├── index.html
│   ├── input.html
│   ├── results.html
│   ├── dashboard.html
│   ├── css/style.css
│   └── js/
│       ├── app.js
│       ├── hdb.js
│       ├── input.js
│       └── results.js
├── backend/
│   ├── index.js
│   ├── package.json
│   ├── .env.example
│   ├── models/db.js
│   ├── middleware/auth.js
│   ├── routes/
│   ├── services/
│   └── sql/schema.sql
└── README.md
```

## Prerequisites

- Node.js 18+ recommended
- npm
- MySQL 8+

Optional, depending on the features you want to use:

- OneMap account credentials for commute/geocoding
- SMTP credentials for password reset emails

## Setup

### 1. Install backend dependencies

```bash
cd backend
npm install
```

The repo already includes `backend/node_modules/`, but running `npm install` ensures dependencies match `package-lock.json`.

### 2. Create the MySQL database

```sql
CREATE DATABASE homematch;
```

### 3. Load the schema

```bash
mysql -u root -p homematch < backend/sql/schema.sql
```

### 4. Configure environment variables

Copy `backend/.env.example` to `backend/.env` and update the values for your machine.

Expected variables:

```env
PORT=3001
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=homematch

JWT_SECRET=change_me_to_a_long_random_secret
FRONTEND_URL=http://localhost:5500

ONEMAP_EMAIL=your@email.com
ONEMAP_PASSWORD=your_onemap_password
ONEMAP_TOKEN=

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=noreply@homematch.sg
```

Notes:

- The checked-in `.env.example` still mentions `DATABASE_URL`, but the actual backend code reads MySQL-style variables from `backend/models/db.js`.
- `ONEMAP_EMAIL` and `ONEMAP_PASSWORD` are required only for live commute routing.
- SMTP variables are required only for the forgot/reset password flow.

## Running the Project

You need two local servers:

### Terminal 1: start the backend

```bash
cd backend
npm start
```

Backend runs on:

```text
http://localhost:3001
```

Health check:

```text
GET http://localhost:3001/api/health
```

### Terminal 2: serve the frontend

From the repo root:

```bash
python3 -m http.server 5500 --directory frontend
```

Frontend runs on:

```text
http://localhost:5500/index.html
```

## Main User Flow

1. Open `index.html`
2. Start as guest or create an account
3. Fill in personal, financial, and location preferences in `input.html`
4. View results in `results.html`
5. Logged-in users can access `dashboard.html` and save searches

## API Endpoints

### Health

- `GET /api/health`

### Authentication

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/auth/me`

### Saved Searches

- `POST /api/auth/saved-searches`
- `GET /api/auth/saved-searches`
- `DELETE /api/auth/saved-searches/:id`

### Calculators

- `POST /api/grants/calculate`
- `POST /api/affordability/calculate`

### Recommendations

- `POST /api/recommendations`

## Database Schema

The current schema creates two tables:

- `users`
- `saved_searches`

Key fields:

- `users.email` is unique
- `saved_searches.form_data` and `saved_searches.results` are stored as JSON
- `saved_searches.user_id` is a foreign key to `users.id`

## Important Implementation Notes

### Frontend results are still using mock data

The backend recommendation route exists and fetches live data, but the current `frontend/js/results.js` still returns `MOCK_RESULTS` inside `fetchRecommendations()` instead of calling `/api/recommendations`.

That means:

- the UI works for demos
- backend recommendation logic exists
- the frontend and backend recommendation flow are not fully wired together yet

### Client-side and server-side grant logic both exist

`frontend/js/hdb.js` mirrors `backend/services/grantCalculator.js` so users can see instant feedback in the form before submitting anything.

### External API fallbacks

- Recommendation scoring falls back to heuristics when live routing data is unavailable
- Commute scoring is skipped if OneMap geocoding or token retrieval fails

## Known Gaps

- `backend/.env.example` does not fully match the actual MySQL configuration used by the backend
- `results.js` is still mocked instead of calling the live recommendation API
- There is a duplicate `Untitled/` copy of the project in the repository root that does not appear to be part of the main app runtime
- No automated test suite is currently configured in the visible project files

## Troubleshooting

### Backend starts but auth fails

Check:

- MySQL is running
- the `homematch` database exists
- `backend/.env` has the correct `DB_*` values
- `JWT_SECRET` is set

### Results page loads but data looks static

This is expected with the current codebase because `frontend/js/results.js` still uses mock data.

### Password reset does not send emails

Check:

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM`
- whether your provider requires an app password or extra SMTP configuration

### Commute scoring is missing or inaccurate

Check:

- `ONEMAP_EMAIL` and `ONEMAP_PASSWORD`
- network access to OneMap APIs

## Suggested Next Improvements

- Connect `frontend/js/results.js` to `POST /api/recommendations`
- Add a proper frontend build/dev server or serve static assets from Express
- Align `backend/.env.example` with the real environment variables used by the app
- Add tests for grant logic, affordability calculations, and auth routes
- Remove or archive the duplicate `Untitled/` directory if it is no longer needed

## License

No license file is currently present in this repository.
