# Legacy VS Code AI Agent Sprint Prompts

> **Superseded:** Use [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) as the canonical scope and delivery roadmap. These older prompts predate the current codebase and must be reconciled against the repository and production migration history before use.

The prompts below are preserved for historical reference only. Do not run them verbatim; use the current repository and the canonical implementation plan to create up-to-date tasks.

## Sprint 1: Complete Remaining Tables & RLS Policies
> Expand `supabase/migrations/20261123000001_initial_upwa_isms_schema.sql` to include full RLS policies per role (`UPWA_PRESIDENT`, `PRIMARY_HEAD`, `SECONDARY_PRINCIPAL`, `BURSAR`, `TEACHER`, `PARENT`, `GATE_SECURITY`) and wire Supabase SSR authentication in `src/app/login/page.tsx`.

## Sprint 2: Public Website CMS, Online Admissions & CSV Student Registry
> Connect `src/app/page.tsx` Admissions and Public CMS sections to real Supabase tables with private Storage uploads for student passports and CSV dry-run import validation.

## Sprint 3: Spreadsheet Broadsheets, Approval Workflow & PDF Report Cards
> Wire `src/app/page.tsx` Results & QR Centre to Supabase `score_entries` and `report_verification`, adding PDF report card generation with HMAC-signed QR codes and Smart Fee-Lock enforcement.

## Sprint 4: Financial Reconciliation, Executive Analytics & Automated Tests
> Connect `src/app/api/webhooks/paystack/route.ts` and the Financial Tracker to `invoices`, `receipts`, and `ledger_entries`, add Recharts executive charts, and create Vitest/Playwright tests for division scoping and webhook idempotency.
