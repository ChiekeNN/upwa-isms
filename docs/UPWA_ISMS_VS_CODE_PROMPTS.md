# UPWA-ISMS VS Code AI Agent Sprint Prompts

Open this workspace in VS Code, run `npm install`, copy `.env.example` to `.env.local`, and run the 4 Sprint Prompts sequentially in your VS Code AI Coding Agent (Copilot Agent / Cursor / Cline):

## Sprint 1: Complete Remaining Tables & RLS Policies
> Expand `supabase/migrations/20261123000001_initial_upwa_isms_schema.sql` to include full RLS policies per role (`UPWA_PRESIDENT`, `PRIMARY_HEAD`, `SECONDARY_PRINCIPAL`, `BURSAR`, `TEACHER`, `PARENT`, `GATE_SECURITY`) and wire Supabase SSR authentication in `src/app/login/page.tsx`.

## Sprint 2: Public Website CMS, Online Admissions & CSV Student Registry
> Connect `src/app/page.tsx` Admissions and Public CMS sections to real Supabase tables with private Storage uploads for student passports and CSV dry-run import validation.

## Sprint 3: Spreadsheet Broadsheets, Approval Workflow & PDF Report Cards
> Wire `src/app/page.tsx` Results & QR Centre to Supabase `score_entries` and `report_verification`, adding PDF report card generation with HMAC-signed QR codes and Smart Fee-Lock enforcement.

## Sprint 4: Financial Reconciliation, Executive Analytics & Automated Tests
> Connect `src/app/api/webhooks/paystack/route.ts` and the Financial Tracker to `invoices`, `receipts`, and `ledger_entries`, add Recharts executive charts, and create Vitest/Playwright tests for division scoping and webhook idempotency.
