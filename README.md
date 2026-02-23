# Clarify - Online Doubt Solving Platform

Clarify is a full-stack web app where users can:
- Sign up / log in
- Ask doubts
- View recent doubts
- Post answers to others' doubts
- Track solved counts and usage streak
- View trending topic cards

## Tech Stack

- Frontend: React + Vite + React Router
- Backend: Spring Boot 3 (Java 17), Spring Security, Spring Data JPA
- Database: H2 file database (`backend/data/doubts.mv.db`)

## Project Structure

```text
clarify/
  backend/    # Spring Boot API
  frontend/   # React app
```

## Prerequisites

- Java 17
- Node.js 18+ and npm

## Run Locally

### 1) Start backend

```bash
cd backend
sh mvnw spring-boot:run
```

Backend runs on:
- `http://localhost:8081`

### 2) Start frontend

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on:
- `http://localhost:5173`

## Default Demo Credentials

- `user / password`
- `admin / admin`

## Build Commands

Frontend:

```bash
cd frontend
npm run build
```

Backend (compile):

```bash
cd backend
sh mvnw -DskipTests compile
```

## Notes

- Frontend API base URL is currently hardcoded to:
  - `frontend/src/api.js` -> `http://localhost:8081`
- If backend is down, some actions use local fallback storage in browser (`localStorage`) for doubts/replies.

## Troubleshooting

### `Bad Request` on submit
- Ensure you are logged in before posting.
- Restart backend and frontend after pulling latest changes.
- Hard refresh browser (`Ctrl/Cmd + Shift + R`).

### Backend not starting (H2 lock)
- Another backend process may already be using `backend/data/doubts.mv.db`.
- Stop duplicate Java processes and start backend again.

### CORS / API errors
- Confirm frontend is on `5173` and backend on `8081`.
- Confirm backend is running before frontend submit actions.
