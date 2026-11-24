# UPWA International Schools Management Platform — Implementation Plan

**Status:** Product scope and delivery roadmap  
**Institution:** University of Port Harcourt Women Association (UPWA) International Schools, Choba, Rivers State, Nigeria  
**Purpose:** Build one cohesive, secure, multi-role School Management Platform while keeping the public website informational and the management portal restricted to authorised users.

> This is the target plan, not a statement that every feature is already implemented. Existing code and migrations form a starting point; each phase must be audited, completed, tested, and approved before its features are described as production-ready.

## 1. Product principles

1. **Public website first:** Public pages provide verified information about the school, its divisions, academic structure, admissions, news, and events. The management portal is a secondary staff/family service and always requires an authorised account.
2. **Least privilege:** Authentication identifies the person; roles and permissions govern every page, API operation, and database row. PostgreSQL Row-Level Security (RLS) is the enforcement layer, not just UI hiding.
3. **Historical integrity:** Academic and financial records are session/term scoped, versioned where necessary, and never silently overwritten after approval or publication.
4. **No invented school records:** Production data must come from authorised UPWA sources. Synthetic data may be used in automated tests only and must never be mistaken for actual school data.
5. **Auditable workflows:** Sensitive actions (role changes, result approvals, fee adjustments, payment reviews, report release, and communications) record the actor, timestamp, action, and relevant entity.
6. **Secure integrations and transport:** Enforce HTTPS/TLS for browser and API traffic (with secure cookies and production headers). API keys, SMTP credentials, payment secrets, and SMS credentials stay in server-side secret stores. Never expose them in browser code, logs, or Git.
7. **Incremental delivery:** Release a complete, tested vertical slice per phase; do not enable unfinished modules in production.

## 2. Target modules and feature scope

The roadmap target is **17+ academic modules/workflows** and **10+ administration modules/workflows**. The counts below are a planning inventory, not a claim that these capabilities are already live; Phase 0 will finalize module boundaries with UPWA and map each one to implementation status and acceptance tests.

**Academic module inventory (19 planned slices):** (1) sessions/terms, (2) education levels, (3) classes/arms, (4) class-subject assignments, (5) subject/curriculum mapping, (6) grading schemes, (7) behaviour ratings, (8) psychomotor/affective skills, (9) attendance, (10) assessment batches and score entry, (11) score imports and validation, (12) result computation, (13) comments, (14) term reports, (15) progress reports, (16) broadsheets, (17) report PINs and verification, (18) academic statistics/trends, and (19) report layouts.

**Administration module inventory (13 planned slices):** (1) member directory, (2) add member, (3) bulk member import, (4) member statistics, (5) admission cycles, (6) admission form templates, (7) application review/enrolment pipeline, (8) organisation profile, (9) education-level configuration, (10) payment accounts, (11) news/categories, (12) galleries/groups, and (13) testimonials/groups.

### 2.1 School Management — Academic Engine

- **Sessions and terms:** Create academic sessions and terms; configure dates, status, and active periods; prevent overlapping or invalid active periods.
- **Education levels, classes, and arms:** Maintain education levels, classes, class arms, class teachers, and class-specific subject assignments.
- **Subjects and curriculum:** Map subjects to education levels, classes, and sessions; support subject ownership and active/inactive status without destroying prior records.
- **Grading systems:** Configure versioned grading scales for academic subjects, behaviour, and attendance according to school-approved standards.
- **Behaviour and skills:** Record school-defined behavioural traits and psychomotor/affective ratings with scale, assessor, term, comments, and audit history.
- **Attendance:** Take daily class attendance using present, absent, and late/punctual states; record authorised corrections and retain historical views.
- **Subject scores:** Enter continuous-assessment and examination scores online or by validated CSV/XLSX import. Show validation errors before saving; calculate totals, grades, averages, and status using the configured scheme.
- **Comments:** Support subject teacher, class teacher, and principal comments per student and term; preserve revisions and approval state.
- **Academic reports:** Generate term reports, progress reports, class broadsheets, and printable A4 documents. Published versions are immutable; corrections create an audited replacement/version.
- **Report PINs and verification:** Issue high-entropy, expiring or revocable report access PINs; store only a secure hash; rate-limit verification and audit access. Public verification must disclose only the minimum permitted result metadata.
- **Academic statistics:** Show permission-scoped student progress, class averages, pass/fail distributions, attendance and multi-term trends. Define each metric with the school before release.
- **Academic layouts:** Configure report-card, broadsheet, and official document templates with preview, versioning, and controlled publication.

### 2.2 Utilities — Communication and Scheduling

- **Calendar:** Display term dates, holidays, examinations, meetings, appointments, and school events with division/audience scope.
- **Event management:** Create, update, cancel, and publish events; track organiser, venue, audience, reminders, and change history.
- **Email and SMS:** Compose individual or bulk messages for authorised target groups; preview recipients and content before dispatch; support delivery status and provider errors.
- **Automated messages:** Define approved triggers such as fee reminders, attendance alerts, and report-release notices. Require templates, recipient rules, consent/policy review, safe retry, and audit logging.
- **Groups and contacts:** Maintain consent-aware, permission-scoped parent, student, and staff contact records; support custom segments without exposing unrelated contacts.
- **Statistics and logs:** Record queued/sent/delivered/failed status where providers supply it; show volumes and campaign metrics without claiming delivery where it is unknown.

### 2.3 Student and Parent Portal

- **Education dashboard:** Show only the linked student's academic standing, GPA/average trends where configured, and attendance summary.
- **Fees and payments:** Provide a secure payment journey with invoice and receipt downloads; verify provider webhooks server-side and make processing idempotent.
- **Fee statement:** Present charges, approved discounts/waivers, payments, allocations, and balance as a traceable ledger.
- **Current class:** Show authorised class, teacher, timetable, and enrolled subjects.
- **Grade book:** Display released/authorised CA scores, tests, examinations, and progress; never reveal draft or another student's scores.
- **Final reports:** Permit PIN-protected, policy-approved report viewing and A4 PDF printing. Parent/student identity linkage and report PIN rules are separate checks.

### 2.4 Account and Security

- **Profile and preferences:** Allow permitted profile fields, avatar, theme, language, and notification preferences; protect institutional identity fields from self-service edits.
- **Account security:** Password reset/change, MFA/2FA, active-session review/revocation where supported, and role-based permissions for administrators, managers, teachers, bursars, parents, and students.
- **Digital wallets:** If approved by UPWA, implement a double-entry/immutable ledger for platform or SMS credits. Wallet transfers, refunds, and cash-equivalent balances require policy, reconciliation, and legal/accounting approval before enablement.
- **History:** Searchable personal notification history and authorised financial transaction history; audit access and restrict retention/export.

### 2.5 Administration

- **Member directory and statistics:** Searchable student, teacher, parent, and non-teaching staff directory; authorised individual creation; demographic aggregates that avoid unnecessary personal-data exposure.
- **Bulk import:** CSV/XLSX preview, field mapping, validation, duplicate detection, dry-run, error download, explicit confirmation, and an import audit record. Never silently overwrite existing identities.
- **Online admissions:** Versioned admission templates/form builder; admission cycles; application pipeline; document handling; review, decision, offer, acceptance, and enrolment actions with audit history.
- **Organisation profile and education levels:** Manage school branding, approved contact/support details, divisions, sections, and education levels. Changes to official public details require review/publish controls.
- **Payment accounts:** Maintain approved bank/settlement accounts with maker-checker review, masking, restricted access, and change audit.
- **Public-content CMS:** Manage news and categories, galleries and gallery groups, testimonials and groups, pages, and publication state. Public pages render only approved/published content.

### 2.6 Settings and Integrations

- **Application settings and add-ons:** Feature flags and institution-wide configuration with validation, change history, and safe defaults; never use a feature flag as a substitute for authorisation.
- **Layout builder:** Structured, versioned templates for forms, reports, invoices, and receipts. Drag-and-drop editing is optional after the structured editor and output validation are reliable.
- **Payment platforms:** Begin with the provider selected by UPWA (current code includes Paystack-related work); evaluate Flutterwave and Stripe separately. Keep provider credentials server-side and reconcile payment events against immutable transactions.
- **Spreadsheet integration:** CSV/XLSX import and export for approved member lists, score sheets, and financial records with field-level access checks, validation, and audit history.
- **API and webhooks:** Versioned REST endpoints, request validation, authentication/signature verification, replay protection, rate limits, idempotency keys, and a public result-verification endpoint with minimal disclosure.

## 3. Architecture and repository structure

Retain the current Next.js App Router, TypeScript, Supabase/PostgreSQL, and Vercel foundation, while progressively organizing domain logic into bounded modules:

```text
src/
  app/                    public pages, authenticated pages, and thin route handlers
  components/             shared presentation components
  features/
    auth/                  sessions, profile, MFA, access helpers
    administration/       members, education levels, admissions, organisation
    academics/             sessions, classes, subjects, attendance, scores, reports
    finance/               fee schedules, invoices, payments, ledger, reconciliation
    communications/        calendar, events, groups, messages, delivery logs
    portal/                parent/student dashboards and release-scoped views
    cms/                   public content and editorial workflows
    integrations/          provider adapters and webhook verification
  lib/
    auth/                  server-side identity and permission checks
    db/                    typed database access and transaction helpers
    validation/            shared Zod request/input schemas
    audit/                 audit event helpers
supabase/
  migrations/              ordered, reviewed schema/RLS migrations
  tests/                   SQL/RLS and database invariant tests
```

Route handlers should validate input and delegate to domain services. Server-only secrets must stay on the server. Browser clients use the public Supabase key and are constrained by RLS. Add automated tests for role boundaries and important workflow transitions before each phase is enabled.

## 4. Relational schema outline

The existing migrations contain a useful foundation (institutions/divisions, roles/permissions, students/guardians, classes, admissions, attendance, assessments, finance, communications, and audit-related objects). Before extending it, inspect the actual deployed schema and migration ledger, reconcile repository migrations with production, and avoid duplicate or incompatible tables.

The target normalized model should include these domain groups:

| Domain | Core entities and integrity rules |
|---|---|
| Organisation | `institutions`, `school_divisions`, `school_sections`, `education_levels`; stable IDs and reviewed public configuration. |
| Academic calendar | `academic_sessions`, `terms`; one explicit active session/term per applicable scope; date and status constraints. |
| Classes/curriculum | `classes`, `class_arms`, `subjects`, `class_subjects`, `staff_class_assignments`; assignments scoped to session/division and retained historically. |
| Identity/RBAC | Supabase `auth.users`, `user_profiles`, `staff_profiles`, `student_profiles`, `guardians`, `student_guardians`, `roles`, `permissions`, `role_permissions`, `user_roles`; explicit scope and least privilege. |
| Enrolment | `student_enrolments` / `class_placements` keyed by student, session, and term or effective dates; historical placements are not overwritten. |
| Assessment | `grading_schemes`, `grading_bands`, `assessment_components`, `assessment_batches`, `assessment_scores`, `behaviour_ratings`, `teacher_comments`; unique student/component/session/term keys and approval state. |
| Attendance | `attendance_sessions`, `attendance_records`; unique student/class/date/session keys; auditable corrections. |
| Reporting | `report_templates` and versions, `term_results`/published snapshots, `report_issues`, hashed `report_pins`, verification audit; published snapshots immutable. |
| Admissions | `admission_cycles`, versioned `admission_templates` and fields, `admission_applications`, documents, reviews, decisions, enrolment conversion; state transitions audited. |
| Finance | `fee_schedules`, `student_charges`, `discounts_waivers`, `invoices`, `payment_transactions`, `payment_allocations`, `receipts`, `ledger_entries`, settlement accounts; idempotent provider references and append-only financial history. |
| Communications | `events`, `calendar_entries`, `contact_groups`, group memberships, message templates/campaigns, `message_deliveries`, notification rules; consent and audience scope retained. |
| CMS | `content_items`, categories, gallery groups/media, testimonials/groups, publication revisions; only approved content is public. |
| Account/integrations | `user_preferences`, sessions/MFA metadata through Auth where supported, `notification_logs`, provider event logs, integration configuration references; secret values remain outside application tables. |
| Audit | Append-only `audit_logs` for sensitive actions; actor, action, entity, timestamp, scope, and non-sensitive change metadata. |

**Historical data rules:** use foreign keys and unique constraints scoped by session/term; use `ON DELETE RESTRICT` or archival status for academic/financial history; snapshot calculation inputs and grading-scheme version at publication; store monetary values as fixed-precision numeric plus currency; use transactions and idempotency for payment processing. Do not store raw card details or plaintext report PINs.

## 5. Role and permission model

Start with permission codes rather than role names embedded throughout UI code. Proposed role templates:

- **Technical platform administrator:** platform configuration and account/role administration only by default; no automatic access to pupil, medical, academic, or finance records.
- **Institution/school administrator:** organisation-wide operational tasks explicitly approved by UPWA.
- **Manager / division leader:** assigned division or section scope, with the specific management permissions approved by UPWA.
- **Teacher:** assigned classes/subjects; enter and review permitted attendance, scores, and comments.
- **Bursar/accountant:** authorised fee, invoice, payment, receipt, and reconciliation tasks; separation between payment creation and approval.
- **Parent/guardian:** linked children only; released records only.
- **Student:** own records and released results only.

Every UI module, API route, storage object, report, and database policy must enforce the same permission and division/relationship scope. Changes to user roles require privileged server-side administration, audit, and confirmation. Before production, map these target roles to existing role codes and obtain UPWA approval for each permission matrix.

## 6. Delivery sequence and milestones

### Phase 0 — Discovery, audit, and safety baseline

- Inventory existing UI, API routes, migrations, deployment variables, and production migration state.
- Mark each requested feature **implemented / partial / not started / blocked**; test the existing behaviour instead of relying on route names.
- Confirm role definitions, divisions/education levels, academic calendar, grading scales, report contents, fee rules, data retention, consent, and payment provider with UPWA.
- Reconcile production schema and migration history; take a verified backup and use a non-production environment for migration rehearsal.
- Define test fixtures with synthetic data only and document a rollback plan.

**Gate:** signed-off data dictionary, permission matrix, and release inventory; no production schema changes until a backup/rehearsal is available.

### Phase 1 — Foundation: authentication, RBAC, architecture

- Harden email/password authentication, password recovery, MFA policy, session handling, and account lifecycle.
- Establish server-side permission helpers, role-scoped navigation, RLS policies, audited role assignment, and API validation conventions.
- Add automated tests proving unauthenticated users cannot access portal routes/data and each role cannot cross its permitted scope.
- Organize shared feature/service/schema patterns without a risky full rewrite.

**Gate:** positive and negative authorization tests pass for every initial role and division.

### Phase 2 — Administration foundations (first operational release)

Build in the requested order:
1. **Education levels, divisions, and sections** with approved configuration.
2. **Sessions and terms** with active-period validation and historical preservation.
3. **Classes, arms, subjects, and class-subject assignments** scoped to the academic session.
4. **Member directory** for students, staff, parents/guardians and non-teaching staff; link accounts without exposing credentials.
5. **Add member and bulk import** with preview, validation, duplicate detection, explicit commit, and import reconciliation.

**Gate:** authorised administrators can configure a school year and import approved members without overwriting historical placements.

### Phase 3 — Academic engine

- Version grading schemes and assessment components.
- Implement attendance and correction workflows.
- Implement behaviour/skills records, score entry/import, automated computation, and validation.
- Implement comments, report approval/publication, immutable report snapshots, report PIN issuance/verification, and A4 output.
- Add academic statistics and versioned report/broadsheet layouts.

**Gate:** end-to-end test from session setup through score entry, independent review/approval, publication, parent/student authorization, and report verification.

### Phase 4 — Admissions and administration completion

- Build admission cycles, versioned form templates, application document workflow, review/decision pipeline, and enrolment conversion.
- Complete organisation profile, payment-account maker/checker flow, public CMS, directory analytics, and controlled exports.

**Gate:** an application can be accepted and converted to an enrolment without duplicate identity or loss of application history.

### Phase 5 — Finance and payment integrations

- Confirm fee structure and policies; implement schedules, invoices, waivers, statements, payment allocations, receipts, immutable ledger, and reconciliation.
- Integrate the selected payment provider first (Paystack currently has code presence); add other gateways only after contract, credentials, and sandbox verification.
- Implement signed/idempotent webhooks and separate maker/approver workflows for sensitive operations.
- Defer digital wallets until policy, regulatory, accounting, and safeguarding review is approved.

**Gate:** provider sandbox tests, duplicate/replay tests, ledger reconciliation, refund/exception workflow, and finance sign-off pass.

### Phase 6 — Student and parent portal

- Implement account-to-student/guardian linking and prove relationship-scope tests.
- Build student and parent dashboards for current class, timetable, subjects, released grade book/results, attendance, statements, invoices, payments, receipts, and final reports.
- Keep draft/unapproved records unavailable to portal users; add accessible, print-ready report views.

**Gate:** users can access only their own or explicitly linked children's released records.

### Phase 7 — Utilities, communications, and settings

- Build calendar/event management and audience scoping.
- Configure and verify transactional email (SMTP) and SMS provider; implement message templates, consent/target checks, queued delivery, retries, delivery logs, volume controls, and reports.
- Add notification rules and account preferences; support bulk sends only after approvals, unsubscribe/consent policy, rate limits, and monitoring are ready.
- Deliver versioned form/report/invoice layout configuration and audited feature toggles.

**Gate:** test messages go only to approved test recipients; failures/retries are observable; no message is falsely shown as delivered.

### Phase 8 — Hardening, training, and phased launch

- Complete accessibility, performance, backup/restore, penetration/security review, data export/retention, incident response, and disaster recovery tests.
- Train administrators, teachers, bursars, and parent/student support users using role-specific materials.
- Pilot by a small approved division and academic period; monitor, fix, then expand.
- Enable production modules only after migration, support, and rollback sign-off.

## 7. UX and quality acceptance criteria

- Responsive layouts; role-specific navigation; accessible labels, focus states, keyboard support, and clear empty/loading/error states.
- Data tables support permission-safe search/filter/sort and CSV/XLSX export only where approved.
- Reports, invoices, and receipts print cleanly on A4 with institution-approved layout, date/session context, and version/status.
- No unsafe direct writes from the browser; mutations pass server validation, authorization, and database constraints.
- Unit, integration, RLS, workflow, import, webhook, and end-to-end tests cover both allowed and denied actions.
- Backups and migrations are rehearsed; each deployment records the exact code version and database migration set.
- Public pages never expose the portal, private records, internal documents, or a no-login portal bypass. The portal remains a secondary service for authorised users.

## 8. Decisions required from UPWA before implementation

1. Final role/permission matrix and which roles can manage divisions, publish reports, approve payments, and view health/medical data.
2. Official education levels, class naming/arms, current session/terms, subjects, score components, grading bands, pass rules, and approved report content.
3. Attendance statuses and correction policy; behaviour/skill rating scales and who may record them.
4. Fee schedules, discounts/waivers, payment approval thresholds, settlement accounts, refunds, and receipt numbering.
5. Email/SMS vendors, sender domain, budget, consent/opt-out policy, message retention, and allowed bulk-message audiences.
6. Parent/student identity proofing and account linking; report PIN length, expiry, revocation, and verification disclosure.
7. Data retention, deletion/correction rules, backup expectations, privacy notices, and incident contacts.
8. Whether a digital wallet is genuinely required; legal/accounting approval before storing or transferring value.

## 9. Initial repository and production baseline

This is a code/migration inventory, not a production-readiness certification. A route, table, or provider adapter counts as code presence only; the workflow still needs role-level tests, deployment verification, and school acceptance.

| Area | Code already present | Main gaps before the full target is met |
|---|---|---|
| Authentication/RBAC | Email/password login and reset flow, role/permission schema, server-side access helper, role-scoped portal APIs and RLS policies. | Verify every route and RLS boundary; complete MFA/session controls, profile preferences, admin account lifecycle, and regression tests. |
| Administration/registry | Student and staff creation, member import workflow, class/subject/section schema, admissions application/review flows. | No complete administrator configuration experience for education levels, sessions/terms, class arms, and subject assignments; expand parent/guardian/non-teaching-member workflows and import/export. |
| Academic engine | Attendance, score entry, assessment components/batches, result/report snapshot and verification code, academic comments/behaviour-related schema. | Finish grading and school-defined scale administration, behavior/skills UI, calculation/approval coverage, term dashboards, report layouts, and the end-to-end teacher-to-parent release workflow. |
| Finance | Invoice/payment/receipt/ledger schema and APIs, payment evidence/review, bank-account support, and Paystack-related webhook code. | Complete fee statements, waivers, finance reporting/reconciliation UX, production provider verification, remaining gateways, and wallets only after policy approval. |
| Student/parent access | Parent/student roles and permission concepts exist in the portal model. | Build dedicated, relationship-scoped dashboards and account-linking flows; confirm students/guardians can see only released records for themselves or linked children. |
| Communications/utilities | Notification templates/outbox/attempts and scheduled delivery code for provider adapters. | Build calendar/events, contact groups, campaign composition/preview, consent controls, delivery analytics, and verify production SMTP/SMS credentials. |
| Public CMS | Public content APIs and a basic website content workflow exist. | Complete reviewed publishing for categories, galleries/groups, testimonials/groups, and richer public page management. |
| Settings/integrations | REST route handlers, CSV-oriented import, webhooks, report verification, and selected provider adapters exist. | Add the settings/layout experience, XLSX import/export, additional contracted gateways, integration health/logging, and complete integration/security tests. |

### Production migration gate

The latest Supabase migration-history check found only the first four repository migrations recorded in production. Read-only checks also confirmed representative tables from both later migrations are absent (`assessment_batches`, `finance_activity`, `communication_preferences`, `notification_outbox`, and `payment_evidence`). The following repository migrations were not recorded at that check:

- `supabase/migrations/20261123230000_results_finance_and_executive.sql`
- `supabase/migrations/20261124010000_executive_communications_gate_care.sql`

Do not treat features that depend on those migrations as production-ready. Before adding more database changes, verify the live schema/history, take a recoverable backup, rehearse the exact ordered migrations in a non-production database, and prepare rollback/monitoring. No production database migration was applied as part of this audit.

### Recommended next vertical slice

Proceed in this order: (1) test/document authentication and RBAC boundaries, (2) deliver authorised admin screens for education levels and sessions/terms, (3) add classes/arms/subject assignments, (4) finish member creation/import and guardian linking, then (5) wire those configurations into attendance, grading, and score workflows. This creates a usable administrative foundation without introducing fictional school records or bypassing portal security.

The reference page at `nersapp.africa/features` could not be inspected from this workspace. The feature requirements in this plan remain the functional source of truth; visual matching should use screenshots or a visual capture supplied by UPWA, while preserving UPWA branding and portal authorization.
