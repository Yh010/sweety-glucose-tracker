# Sweety

## Platform
web

## Stack
Separate React + TypeScript + Tailwind frontend and Node.js + Express + TypeScript backend; PostgreSQL. No shadcn.

## Users and purpose
Patients record up to four blood glucose readings per date and review daily, month-to-date, and previous-month reports. This is a hiring assessment, not a clinical decision system.

## Constraints
Each user sees only their own data. Four named meal slots. Integer glucose values 40–600 mg/dl. No future dates. bcrypt password hashes. Required setup instructions, demo seed, meaningful tests and screenshots. Assignment deadline 14 November 2026.

## Design assumptions
Design choices are delegated by the user. Prioritize a clear daily workflow, keyboard access, readable numbers, and responsive layouts. Use calm copy; do not infer clinical categories or provide treatment advice. A configurable application timezone determines today's date consistently.
