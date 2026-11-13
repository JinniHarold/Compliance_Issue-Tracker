# Compliance Issue Tracker

Monorepo: `backend/` (Express + SQLite + TypeScript, finished and tested) and `frontend/` (React + Vite + TypeScript + Tailwind).

## Always
- Work only on what was asked. Do not modify `backend/` unless explicitly told.
- Keep replies short: list the files changed and how to verify. Do not repeat unchanged code.
- Never commit or print secrets, `.env` files, tokens, or database files.
- For any frontend work, follow the `compliance-frontend` skill.

## Commands
- Frontend: `cd frontend && npm run dev` (http://localhost:5173), `npm run build` to type-check.
- Backend: `cd backend && npm run dev` (http://localhost:3000), `npm test`.