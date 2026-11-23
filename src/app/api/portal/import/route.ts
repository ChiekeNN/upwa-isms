import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requirePortalAccess } from "@/lib/auth/portal-access";

type Row = Record<string, string>;
type CheckedRow = { line: number; values: Row; errors: string[] };
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 2000;

function parseCsv(source: string): Row[] {
  const text = source.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell.length === 0) quoted = true;
    else if (char === ",") { row.push(cell); cell = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell); cell = "";
      if (row.some((item) => item.trim() !== "")) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (quoted) throw new Error("CSV contains an unclosed quote.");
  row.push(cell);
  if (row.some((item) => item.trim() !== "")) rows.push(row);
  if (rows.length < 2) throw new Error("CSV needs a header row and at least one record.");
  if (rows.length - 1 > MAX_ROWS) throw new Error(`Maximum ${MAX_ROWS} records per import.`);

  const headers = rows[0].map((header) => header.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""));
  if (new Set(headers).size !== headers.length || headers.some((header) => !header)) throw new Error("CSV headers must be non-empty and unique.");
  if (rows.slice(1).some((values) => values.length > headers.length)) throw new Error("A CSV record contains more cells than the header row.");
  return rows.slice(1).map((values) => headers.map((header, index) => [header, (values[index] ?? "").trim()] as const))
    .map((pairs) => Object.fromEntries(pairs));
}

function validateRows(rows: Row[], type: "STUDENTS" | "STAFF", classNames: Set<string>, existing: Set<string>): CheckedRow[] {
  const seenIds = new Set<string>();
  const seenPeople = new Set<string>();
  return rows.map((values, index) => {
    const errors: string[] = [];
    if (type === "STUDENTS") {
      const admissionNumber = values.admission_number?.trim();
      const firstName = values.first_name?.trim();
      const lastName = values.last_name?.trim();
      const className = values.class_name?.trim();
      if (!admissionNumber || !/^[A-Za-z0-9/-]{3,40}$/.test(admissionNumber)) errors.push("Valid admission_number is required.");
      if (!firstName || firstName.length > 80) errors.push("first_name is required (max 80 characters).");
      if (!lastName || lastName.length > 80) errors.push("last_name is required (max 80 characters).");
      if (!className || !classNames.has(className.toLowerCase())) errors.push("class_name must match a class in the selected division.");
      const dateOfBirth = values.date_of_birth?.trim();
      const parsedBirthDate = dateOfBirth ? new Date(`${dateOfBirth}T00:00:00Z`) : null;
      if (dateOfBirth && (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || Number.isNaN(parsedBirthDate?.getTime()) || parsedBirthDate?.toISOString().slice(0, 10) !== dateOfBirth || dateOfBirth > new Date().toISOString().slice(0, 10))) errors.push("date_of_birth must be a valid past date in YYYY-MM-DD format.");
      const gender = values.gender?.trim().toUpperCase();
      if (gender && !["FEMALE", "MALE", "UNSPECIFIED"].includes(gender)) errors.push("gender must be FEMALE, MALE or UNSPECIFIED.");
      if (admissionNumber && existing.has(`id:${admissionNumber.toLowerCase()}`)) errors.push("Admission number already exists; existing records are never overwritten.");
      if (admissionNumber && seenIds.has(admissionNumber.toLowerCase())) errors.push("Duplicate admission number in this file.");
      if (admissionNumber) seenIds.add(admissionNumber.toLowerCase());
      const personKey = `${firstName?.toLowerCase()}|${lastName?.toLowerCase()}|${dateOfBirth}`;
      if (firstName && lastName && dateOfBirth && existing.has(`person:${personKey}`)) errors.push("Possible existing pupil with the same name and birth date; reconcile before import.");
      if (firstName && lastName && dateOfBirth && seenPeople.has(personKey)) errors.push("Possible duplicate pupil in this file; reconcile before import.");
      if (firstName && lastName && dateOfBirth) seenPeople.add(personKey);
      return { line: index + 2, values: { admission_number: admissionNumber ?? "", first_name: firstName ?? "", middle_name: values.middle_name?.trim() ?? "", last_name: lastName ?? "", date_of_birth: dateOfBirth ?? "", gender: gender ?? "", class_name: className ?? "" } as Row, errors };
    }

    const staffNumber = values.staff_number?.trim();
    const fullName = values.full_name?.trim();
    if (!staffNumber || !/^[A-Za-z0-9/-]{2,40}$/.test(staffNumber)) errors.push("Valid staff_number is required.");
    if (!fullName || fullName.length > 160) errors.push("full_name is required (max 160 characters).");
    const status = (values.employment_status || "ACTIVE").trim().toUpperCase();
    if (!["ACTIVE", "ON_LEAVE", "ENDED"].includes(status)) errors.push("employment_status must be ACTIVE, ON_LEAVE or ENDED.");
    if (staffNumber && existing.has(`id:${staffNumber.toLowerCase()}`)) errors.push("Staff number already exists; existing records are never overwritten.");
    if (staffNumber && seenIds.has(staffNumber.toLowerCase())) errors.push("Duplicate staff number in this file.");
    if (staffNumber) seenIds.add(staffNumber.toLowerCase());
    return { line: index + 2, values: { staff_number: staffNumber ?? "", full_name: fullName ?? "", position_title: values.position_title?.trim() ?? "", employment_status: status, subjects: values.subjects?.trim() ?? "" }, errors };
  });
}

export async function GET(request: NextRequest) {
  const division = request.nextUrl.searchParams.get("division") || "ALL";
  const result = await requirePortalAccess(division, ["registry.manage"]);
  if (!result.ok) return result.response;
  let query = result.access.supabase.from("data_import_jobs").select("id, entity_type, source_filename, total_rows, inserted_rows, duplicate_rows, error_rows, status, created_at, completed_at").order("created_at", { ascending: false }).limit(30);
  if (result.access.divisionId) query = query.eq("division_id", result.access.divisionId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Could not load import history." }, { status: 503 });
  return NextResponse.json({ jobs: data ?? [] });
}

export async function POST(request: NextRequest) {
  let form: FormData;
  try { form = await request.formData(); } catch {
    return NextResponse.json({ error: "A multipart CSV upload is required." }, { status: 400 });
  }
  const division = String(form.get("division") ?? "");
  const entityType = String(form.get("entityType") ?? "");
  const action = String(form.get("action") ?? "preview");
  const file = form.get("file");
  const jobId = String(form.get("jobId") ?? "");
  if (!["PRIMARY_EARLY_YEARS", "SECONDARY"].includes(division) || !["STUDENTS", "STAFF"].includes(entityType) || !["preview", "commit"].includes(action) || !(file instanceof File)) {
    return NextResponse.json({ error: "Choose a division, import type and CSV file." }, { status: 400 });
  }
  const accessResult = await requirePortalAccess(division, ["registry.manage"]);
  if (!accessResult.ok) return accessResult.response;
  const { access } = accessResult;
  if (!access.divisionId) return NextResponse.json({ error: "Choose one school division." }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_FILE_BYTES || (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv")) {
    return NextResponse.json({ error: "Upload a CSV file up to 2 MB." }, { status: 400 });
  }

  let rows: Row[];
  try { rows = parseCsv(await file.text()); } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Could not parse CSV." }, { status: 400 });
  }
  const requiredHeaders = entityType === "STUDENTS"
    ? ["admission_number", "first_name", "last_name", "class_name"]
    : ["staff_number", "full_name"];
  const headers = new Set(Object.keys(rows[0] ?? {}));
  const missing = requiredHeaders.filter((header) => !headers.has(header));
  if (missing.length) return NextResponse.json({ error: `Missing CSV columns: ${missing.join(", ")}.` }, { status: 400 });

  const [classResult, existingResult, jobsResult] = await Promise.all([
    access.supabase.from("classes").select("id, name").eq("division_id", access.divisionId),
    entityType === "STUDENTS"
      ? access.supabase.from("students").select("admission_number, first_name, last_name, date_of_birth").eq("current_division_id", access.divisionId).limit(10000)
      : access.supabase.from("staff_profiles").select("staff_number").eq("division_id", access.divisionId).limit(10000),
    action === "commit" && jobId
      ? access.supabase.from("data_import_jobs").select("id, file_sha256, entity_type, division_id, total_rows, error_rows, status").eq("id", jobId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (classResult.error || existingResult.error) return NextResponse.json({ error: "Could not load authorised validation records." }, { status: 503 });
  const classNames = new Set((classResult.data ?? []).map((item) => item.name.toLowerCase()));
  const existing = new Set<string>();
  for (const item of existingResult.data ?? []) {
    if (entityType === "STUDENTS") {
      const student = item as { admission_number: string; first_name: string; last_name: string; date_of_birth: string | null };
      existing.add(`id:${student.admission_number.toLowerCase()}`);
      if (student.date_of_birth) existing.add(`person:${student.first_name.toLowerCase()}|${student.last_name.toLowerCase()}|${student.date_of_birth}`);
    } else existing.add(`id:${(item as { staff_number: string }).staff_number.toLowerCase()}`);
  }
  const checked = validateRows(rows, entityType as "STUDENTS" | "STAFF", classNames, existing);
  const validationIssueCount = checked.reduce((count, row) => count + row.errors.length, 0);
  const errorRows = checked.filter((row) => row.errors.length > 0).length;
  const duplicateRows = checked.filter((row) => row.errors.some((message) => message.toLowerCase().includes("duplicate") || message.toLowerCase().includes("already exists") || message.toLowerCase().includes("possible existing"))).length;
  const fileHash = createHash("sha256").update(Buffer.from(await file.arrayBuffer())).digest("hex");
  const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "school-import.csv";

  if (action === "preview") {
    const { data: job, error: insertError } = await access.supabase.from("data_import_jobs").insert({
      entity_type: entityType,
      division_id: access.divisionId,
      imported_by: access.user.id,
      source_filename: safeFilename,
      file_sha256: fileHash,
      total_rows: checked.length,
      duplicate_rows: duplicateRows,
      error_rows: errorRows,
      status: "PREVIEW",
      summary: { headers: Object.keys(rows[0] ?? {}), valid_rows: checked.length - checked.filter((row) => row.errors.length).length },
    }).select("id").single();
    if (insertError || !job) return NextResponse.json({ error: "The preview could not be recorded in the import log." }, { status: 403 });
    return NextResponse.json({
      jobId: job.id,
      entityType,
      totalRows: checked.length,
      validRows: checked.filter((row) => row.errors.length === 0).length,
      duplicateRows,
      errorRows: checked.filter((row) => row.errors.length > 0).length,
      rows: checked.map(({ line, values, errors: rowErrors }) => ({ line, values, errors: rowErrors })),
      canCommit: validationIssueCount === 0,
    });
  }

  const job = jobsResult.data;
  if (jobsResult.error || !job || job.file_sha256 !== fileHash || job.entity_type !== entityType || job.division_id !== access.divisionId || job.total_rows !== checked.length || job.error_rows !== 0 || job.status !== "PREVIEW") {
    return NextResponse.json({ error: "The preview does not match this file, division or import. Run preview again." }, { status: 409 });
  }
  if (validationIssueCount > 0) return NextResponse.json({ error: "The file now contains validation errors. Run a new preview and reconcile them first." }, { status: 409 });

  const rpcName = entityType === "STUDENTS" ? "upwa_import_students" : "upwa_import_staff";
  const records = checked.map(({ values }) => values);
  const { data, error } = await access.supabase.rpc(rpcName, {
    p_job_id: job.id,
    p_division_id: access.divisionId,
    p_records: records,
  });
  if (error) return NextResponse.json({ error: "Import failed. No existing records were overwritten; preview and reconcile the file before retrying." }, { status: 409 });
  return NextResponse.json({ importedRows: data, status: "COMPLETED" });
}
