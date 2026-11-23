"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import {
  ShieldCheck,
  GraduationCap,
  Building2,
  Wallet,
  QrCode,
  UserCheck,
  FileSpreadsheet,
  Bell,
  Lock,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Users,
  BookOpen,
  CreditCard,
  Search,
  ChevronRight,
  FileText,
  Sparkles,
  Calendar,
  MapPin,
  Phone,
  Mail,
} from "lucide-react";
import { INSTITUTION_CONFIG, type DivisionCode } from "@/config/institution";

type AppSurface = "PUBLIC_SITE" | "UPWA_ISMS";
type PortalTab = "EXECUTIVE" | "RESULTS_QR" | "FINANCE" | "PICKUP" | "ADMISSIONS";

interface StudentScore {
  id: string;
  admissionNo: string;
  name: string;
  division: "PRIMARY_EARLY_YEARS" | "SECONDARY";
  className: string;
  ca1: number;
  ca2: number;
  exam: number;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "PUBLISHED";
  feeCleared: boolean;
  qrRef: string;
}

const INITIAL_SCORES: StudentScore[] = [
  {
    id: "1",
    admissionNo: "UPWA/PRI/24/0104",
    name: "Chidinma Okafor",
    division: "PRIMARY_EARLY_YEARS",
    className: "Primary 5A",
    ca1: 18,
    ca2: 19,
    exam: 54,
    status: "PUBLISHED",
    feeCleared: true,
    qrRef: "UPWA-RPT-2026-8841A",
  },
  {
    id: "2",
    admissionNo: "UPWA/PRI/24/0119",
    name: "Tamunoemi Briggs",
    division: "PRIMARY_EARLY_YEARS",
    className: "Primary 5A",
    ca1: 15,
    ca2: 16,
    exam: 46,
    status: "APPROVED",
    feeCleared: false,
    qrRef: "UPWA-RPT-2026-8842B",
  },
  {
    id: "3",
    admissionNo: "UPWA/SEC/23/0412",
    name: "David Nwosu",
    division: "SECONDARY",
    className: "SSS 2 Science",
    ca1: 17,
    ca2: 18,
    exam: 52,
    status: "PUBLISHED",
    feeCleared: true,
    qrRef: "UPWA-RPT-2026-9104C",
  },
  {
    id: "4",
    admissionNo: "UPWA/SEC/25/0508",
    name: "Zainab Musa",
    division: "SECONDARY",
    className: "JSS 2 Gold",
    ca1: 19,
    ca2: 18,
    exam: 56,
    status: "SUBMITTED",
    feeCleared: true,
    qrRef: "UPWA-RPT-2026-9109D",
  },
];

const FINANCIAL_METRICS: Record<
  DivisionCode,
  {
    enrolment: number;
    staff: number;
    attendanceRate: string;
    billed: number;
    collected: number;
    expensesApproved: number;
    cashPosition: number;
  }
> = {
  ALL: {
    enrolment: 842,
    staff: 96,
    attendanceRate: "96.4%",
    billed: 126400000,
    collected: 109850000,
    expensesApproved: 48200000,
    cashPosition: 61650000,
  },
  PRIMARY_EARLY_YEARS: {
    enrolment: 478,
    staff: 54,
    attendanceRate: "97.1%",
    billed: 64200000,
    collected: 57100000,
    expensesApproved: 24900000,
    cashPosition: 32200000,
  },
  SECONDARY: {
    enrolment: 364,
    staff: 42,
    attendanceRate: "95.5%",
    billed: 62200000,
    collected: 52750000,
    expensesApproved: 23300000,
    cashPosition: 29450000,
  },
};

function formatNaira(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

function computeGrade(total: number): { grade: string; remark: string } {
  if (total >= 75) return { grade: "A1", remark: "Distinction" };
  if (total >= 70) return { grade: "B2", remark: "Very Good" };
  if (total >= 65) return { grade: "B3", remark: "Good" };
  if (total >= 50) return { grade: "C6", remark: "Credit" };
  return { grade: "F9", remark: "Needs Support" };
}

export default function UpwaIsmsPlatform() {
  const [surface, setSurface] = useState<AppSurface>("UPWA_ISMS");
  const [division, setDivision] = useState<DivisionCode>("ALL");
  const [activeTab, setActiveTab] = useState<PortalTab>("EXECUTIVE");
  const [scores, setScores] = useState<StudentScore[]>(INITIAL_SCORES);
  const [smartFeeLockEnabled, setSmartFeeLockEnabled] = useState<boolean>(true);
  const [qrInput, setQrInput] = useState<string>("UPWA-RPT-2026-8841A");
  const [pickupLog, setPickupLog] = useState([
    {
      id: "PK-901",
      pupil: "Chidinma Okafor (Primary 5A)",
      guardian: "Mrs. Ngozi Okafor (Mother - Verified Photo)",
      time: "14:18 WAT",
      officer: "Sgt. B. Tamuno (Gate A)",
      status: "RELEASED",
    },
  ]);
  const [receiptVerified, setReceiptVerified] = useState<boolean>(false);
  const [admissionSubmitted, setAdmissionSubmitted] = useState<string | null>(null);

  const metrics = FINANCIAL_METRICS[division];
  const collectionPct = Math.round((metrics.collected / metrics.billed) * 100);

  const filteredScores = useMemo(() => {
    if (division === "ALL") return scores;
    return scores.filter((s) => s.division === division);
  }, [scores, division]);

  const verifiedRecord = useMemo(() => {
    return scores.find((s) => s.qrRef.toLowerCase() === qrInput.trim().toLowerCase());
  }, [scores, qrInput]);

  const handleScoreUpdate = (id: string, field: "ca1" | "ca2" | "exam", raw: string) => {
    const num = Math.max(0, Number(raw) || 0);
    const max = field === "exam" ? 60 : 20;
    const clamped = Math.min(max, num);
    setScores((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (item.status === "APPROVED" || item.status === "PUBLISHED") return item;
        return { ...item, [field]: clamped };
      })
    );
  };

  const handleApproveScore = (id: string) => {
    setScores((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: "PUBLISHED" } : item))
    );
  };

  const handleReleasePupil = () => {
    const alreadyOut = pickupLog.some((p) => p.pupil.includes("Tamunoemi Briggs"));
    if (alreadyOut) return;
    setPickupLog((prev) => [
      {
        id: `PK-${902 + prev.length}`,
        pupil: "Tamunoemi Briggs (Primary 5A)",
        guardian: "Mr. Daminabo Briggs (Father - Verified Photo)",
        time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) + " WAT",
        officer: "Sgt. B. Tamuno (Gate A)",
        status: "RELEASED",
      },
      ...prev,
    ]);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Institutional Switcher Bar */}
      <header className="bg-upwa-navy text-white border-b border-slate-800 border-t-4 border-t-upwa-orange-500 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-16 py-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex w-full min-w-0 items-center gap-3 sm:w-auto sm:flex-1">
            <Image
              src="/upwa-logo.png"
              alt="UPWA International Schools official logo"
              width={180}
              height={200}
              priority
              className="h-12 w-11 shrink-0 object-contain drop-shadow-sm"
            />
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`font-bold tracking-tight leading-tight ${
                    surface === "PUBLIC_SITE"
                      ? "text-base sm:text-lg"
                      : "text-sm sm:text-base lg:text-lg"
                  }`}
                >
                  {surface === "PUBLIC_SITE"
                    ? INSTITUTION_CONFIG.institutionalWebsiteName
                    : INSTITUTION_CONFIG.officialPlatformFullName}
                </span>
                <span className="hidden lg:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-upwa-blue-950 text-upwa-blue-300 border border-upwa-blue-800">
                  {INSTITUTION_CONFIG.tagline}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                UPWA International Schools
              </p>
            </div>
          </div>

          <div className="flex w-full items-center gap-2 bg-upwa-navy p-1 rounded-lg border border-slate-800 sm:w-auto">
            <button
              onClick={() => setSurface("PUBLIC_SITE")}
              className={`flex-1 whitespace-nowrap px-3 py-1.5 text-center rounded-md text-xs font-medium transition sm:flex-none ${
                surface === "PUBLIC_SITE"
                  ? "bg-upwa-blue-600 text-white"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Public Website
            </button>
            <button
              onClick={() => setSurface("UPWA_ISMS")}
              className={`flex-1 whitespace-nowrap px-3 py-1.5 text-center rounded-md text-xs font-medium transition sm:flex-none ${
                surface === "UPWA_ISMS"
                  ? "bg-upwa-blue-600 text-white"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              UPWA-ISMS Portal
            </button>
          </div>
        </div>
      </header>

      {/* SURFACE 1: PUBLIC INSTITUTIONAL WEBSITE */}
      {surface === "PUBLIC_SITE" ? (
        <main className="flex-1">
          <section className="bg-gradient-to-br from-upwa-navy via-upwa-navy to-upwa-blue-950 text-white py-16 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-10 items-center">
              <div className="lg:col-span-7 space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-upwa-blue-500/10 border border-upwa-blue-400/30 text-upwa-blue-300 text-xs font-medium">
                  <Sparkles className="w-3.5 h-3.5" />
                  University of Port Harcourt Women Association (UPWA)
                </div>
                <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
                  Nurturing Excellence from Early Years to Secondary Graduation.
                </h1>
                <p className="text-slate-300 text-base sm:text-lg max-w-2xl">
                  Welcome to {INSTITUTION_CONFIG.institutionalWebsiteName}, Choba. Powered by{" "}
                  <strong className="text-white">{INSTITUTION_CONFIG.officialShortName}</strong>{" "}
                  for seamless admissions, verified academic reporting, and transparent parent engagement.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => {
                      setSurface("UPWA_ISMS");
                      setActiveTab("ADMISSIONS");
                    }}
                    className="px-5 py-3 rounded-xl bg-upwa-blue-600 hover:bg-upwa-blue-500 text-white font-semibold text-sm flex items-center gap-2 shadow-lg"
                  >
                    Apply for 2026/2027 Admission
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setSurface("UPWA_ISMS");
                      setActiveTab("RESULTS_QR");
                    }}
                    className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm border border-slate-700"
                  >
                    Parent Result Centre & QR Check
                  </button>
                </div>
              </div>

              <div className="lg:col-span-5 grid gap-4">
                <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
                  <span className="text-xs font-semibold uppercase tracking-wider text-upwa-blue-400">
                    Division A Micro-Portal
                  </span>
                  <h3 className="text-xl font-bold mt-1">Early Years & Primary School</h3>
                  <p className="text-sm text-slate-300 mt-2">
                    Crèche, Nursery, and Primary 1–6 sections offering foundational literacy, STEM discovery, and photo-verified child pickup security.
                  </p>
                </div>
                <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
                  <span className="text-xs font-semibold uppercase tracking-wider text-upwa-orange-400">
                    Division B Micro-Portal
                  </span>
                  <h3 className="text-xl font-bold mt-1">UPWA International Secondary</h3>
                  <p className="text-sm text-slate-300 mt-2">
                    JSS 1–3 and SSS 1–3 academic tracks preparing scholars for WAEC, NECO, and global university placements with digital broadsheets.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8 grid md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <Calendar className="w-6 h-6 text-upwa-blue-600 mb-3" />
              <h3 className="font-bold text-lg">2026/2027 Academic Calendar</h3>
              <p className="text-sm text-slate-600 mt-2">
                First Term resumes September 2026. Entrance examination batches are scheduled online with instant PDF exam slips.
              </p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <GraduationCap className="w-6 h-6 text-upwa-blue-600 mb-3" />
              <h3 className="font-bold text-lg">UPWA Alumnae & Endowment</h3>
              <p className="text-sm text-slate-600 mt-2">
                Supporting merit scholarships, STEM laboratory upgrades, and heritage documentation led by UPWA executives.
              </p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <MapPin className="w-6 h-6 text-upwa-blue-600 mb-3" />
              <h3 className="font-bold text-lg">Campus & Contact</h3>
              <p className="text-sm text-slate-600 mt-2">
                University of Port Harcourt, Choba, Rivers State. Verified administrator-editable CMS content active.
              </p>
            </div>
          </section>
        </main>
      ) : (
        /* SURFACE 2: UPWA-ISMS AUTHENTICATED APPLICATION CONSOLE */
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* 3-Context Division Switcher & Role Banner */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-upwa-blue-100 text-upwa-blue-800">
                  UPWA-ISMS Executive & Operations Shell
                </span>
                <span className="text-xs text-slate-500">Session: 2026/2027 • 1st Term</span>
              </div>
              <h1 className="text-xl font-bold text-slate-900 mt-1">
                {division === "ALL"
                  ? "Consolidated View: All UPWA Schools"
                  : division === "PRIMARY_EARLY_YEARS"
                  ? "Division A: Early Years & Primary (Crèche, Nursery, Primary 1–6)"
                  : "Division B: Secondary School (JSS 1–3 & SSS 1–3)"}
              </h1>
            </div>

            {/* 3-Way Campus / Division Context Switcher */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
              {(
                [
                  { id: "ALL", label: "All UPWA Schools" },
                  { id: "PRIMARY_EARLY_YEARS", label: "Primary / Early Years" },
                  { id: "SECONDARY", label: "Secondary" },
                ] as const
              ).map((ctx) => (
                <button
                  key={ctx.id}
                  onClick={() => setDivision(ctx.id)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
                    division === ctx.id
                      ? "bg-upwa-navy text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {ctx.label}
                </button>
              ))}
            </div>
          </div>

          {/* Module Navigation Tabs */}
          <nav className="flex overflow-x-auto gap-2 pb-1">
            {(
              [
                { id: "EXECUTIVE", label: "Executive Command Console", icon: Building2 },
                { id: "RESULTS_QR", label: "Results & QR Verification", icon: QrCode },
                { id: "FINANCE", label: "Income & Expenditure Ledger", icon: Wallet },
                { id: "PICKUP", label: "Digital Gate Pass (Div A)", icon: UserCheck },
                { id: "ADMISSIONS", label: "Online Admissions", icon: FileText },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap border transition ${
                    activeTab === tab.id
                      ? "bg-upwa-blue-600 text-white border-upwa-blue-600 shadow-sm"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* TAB 1: EXECUTIVE COMMAND CONSOLE */}
          {activeTab === "EXECUTIVE" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                    <span>Active Enrolment</span>
                    <Users className="w-4 h-4 text-upwa-blue-600" />
                  </div>
                  <p className="text-2xl font-extrabold mt-2">{metrics.enrolment} Students</p>
                  <p className="text-xs text-upwa-blue-700 mt-1">
                    {metrics.staff} Staff • Attendance {metrics.attendanceRate}
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                    <span>Fees Collected vs Billed</span>
                    <CreditCard className="w-4 h-4 text-upwa-blue-600" />
                  </div>
                  <p className="text-2xl font-extrabold mt-2">{formatNaira(metrics.collected)}</p>
                  <p className="text-xs text-slate-600 mt-1">
                    {collectionPct}% of {formatNaira(metrics.billed)} billed
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                    <span>Approved Expenditure</span>
                    <FileSpreadsheet className="w-4 h-4 text-amber-600" />
                  </div>
                  <p className="text-2xl font-extrabold mt-2">
                    {formatNaira(metrics.expensesApproved)}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    Segregation-of-duties verified
                  </p>
                </div>

                <div className="bg-upwa-navy text-white p-5 rounded-2xl shadow-sm">
                  <div className="flex items-center justify-between text-slate-300 text-xs font-medium">
                    <span>Reconciled Cash Position</span>
                    <ShieldCheck className="w-4 h-4 text-upwa-blue-400" />
                  </div>
                  <p className="text-2xl font-extrabold mt-2 text-upwa-blue-400">
                    {formatNaira(metrics.cashPosition)}
                  </p>
                  <p className="text-xs text-slate-300 mt-1">
                    Ledger-reconciled net cash movement
                  </p>
                </div>
              </div>

              {/* President's Morning Brief & Live Audit Activity */}
              <div className="grid lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-upwa-blue-700 uppercase tracking-wider">
                        Automated Weekly Executive Digest
                      </span>
                      <h2 className="text-lg font-bold">President&apos;s Morning Brief</h2>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium">
                      Schedule: Weekly (Mondays 07:00)
                    </span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3 text-sm">
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <p className="text-xs text-slate-500">Outstanding Fee Arrears</p>
                      <p className="font-bold text-base mt-0.5">
                        {formatNaira(metrics.billed - metrics.collected)}
                      </p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <p className="text-xs text-slate-500">Pending Executive Approvals</p>
                      <p className="font-bold text-base mt-0.5">2 Expense Vouchers • 1 Result Batch</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    All figures reconcile directly to posted ledger entries under the active division filter. Duplicate-delivery protection and recipient verification are enforced on scheduled dispatches.
                  </p>
                </div>

                <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold">Sanitized Audit Activity Feed</h2>
                    <Bell className="w-4 h-4 text-slate-400" />
                  </div>
                  <ul className="space-y-2.5 text-xs">
                    <li className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="font-semibold text-upwa-green-700">[PAYSTACK_VERIFIED]</span>{" "}
                      Invoice #INV-2026-441 settled via idempotent webhook • 12m ago
                    </li>
                    <li className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="font-semibold text-slate-900">[RESULT_PUBLISHED]</span>{" "}
                      Primary 5A Mathematics broadsheet approved by Head Teacher • 41m ago
                    </li>
                    <li className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="font-semibold text-amber-700">[EXPENSE_APPROVED]</span>{" "}
                      Secondary Lab Reagents (₦340,000) countersigned by Bursar • 2h ago
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RESULTS CENTRE, SMART FEE-LOCK & QR VERIFICATION */}
          {activeTab === "RESULTS_QR" && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold">
                      Teacher CA / Exam Score Sheet & Approval Lock Engine
                    </h2>
                    <p className="text-xs text-slate-500">
                      Configurable weights: 1st CA (20) + 2nd CA (20) + Exam (60) = 100. Approved/Published scores are locked against silent edits.
                    </p>
                  </div>

                  <label className="inline-flex items-center gap-2 text-xs font-semibold bg-amber-50 text-amber-900 px-3 py-2 rounded-xl border border-amber-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={smartFeeLockEnabled}
                      onChange={(e) => setSmartFeeLockEnabled(e.target.checked)}
                      className="rounded text-upwa-blue-600"
                    />
                    <Lock className="w-3.5 h-3.5" />
                    Smart Fee-Lock Policy Active
                  </label>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                        <th className="py-3 px-3 font-semibold">Admission No</th>
                        <th className="py-3 px-3 font-semibold">Student</th>
                        <th className="py-3 px-3 font-semibold">Class</th>
                        <th className="py-3 px-3 font-semibold">1st CA (20)</th>
                        <th className="py-3 px-3 font-semibold">2nd CA (20)</th>
                        <th className="py-3 px-3 font-semibold">Exam (60)</th>
                        <th className="py-3 px-3 font-semibold">Total / Grade</th>
                        <th className="py-3 px-3 font-semibold">Workflow Status</th>
                        <th className="py-3 px-3 font-semibold">Parent PDF / Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredScores.map((row) => {
                        const total = row.ca1 + row.ca2 + row.exam;
                        const { grade, remark } = computeGrade(total);
                        const isLocked = row.status === "APPROVED" || row.status === "PUBLISHED";
                        const blockedByFeeLock = smartFeeLockEnabled && !row.feeCleared;

                        return (
                          <tr key={row.id} className="hover:bg-slate-50/80">
                            <td className="py-3 px-3 font-mono text-[11px]">{row.admissionNo}</td>
                            <td className="py-3 px-3 font-semibold">{row.name}</td>
                            <td className="py-3 px-3">{row.className}</td>
                            <td className="py-3 px-3">
                              <input
                                type="number"
                                disabled={isLocked}
                                value={row.ca1}
                                onChange={(e) => handleScoreUpdate(row.id, "ca1", e.target.value)}
                                className="w-14 px-2 py-1 rounded border border-slate-300 disabled:bg-slate-100"
                              />
                            </td>
                            <td className="py-3 px-3">
                              <input
                                type="number"
                                disabled={isLocked}
                                value={row.ca2}
                                onChange={(e) => handleScoreUpdate(row.id, "ca2", e.target.value)}
                                className="w-14 px-2 py-1 rounded border border-slate-300 disabled:bg-slate-100"
                              />
                            </td>
                            <td className="py-3 px-3">
                              <input
                                type="number"
                                disabled={isLocked}
                                value={row.exam}
                                onChange={(e) => handleScoreUpdate(row.id, "exam", e.target.value)}
                                className="w-16 px-2 py-1 rounded border border-slate-300 disabled:bg-slate-100"
                              />
                            </td>
                            <td className="py-3 px-3 font-bold">
                              {total}% ({grade} - {remark})
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                  row.status === "PUBLISHED"
                                    ? "bg-upwa-green-100 text-upwa-green-800"
                                    : row.status === "APPROVED"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {row.status}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              {row.status !== "PUBLISHED" ? (
                                <button
                                  onClick={() => handleApproveScore(row.id)}
                                  className="px-2.5 py-1 rounded-lg bg-upwa-navy text-white hover:bg-slate-800 text-[11px] font-medium"
                                >
                                  Approve & Publish
                                </button>
                              ) : blockedByFeeLock ? (
                                <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                                  <Lock className="w-3 h-3" /> Restricted (Account Notice)
                                </span>
                              ) : (
                                <button
                                  onClick={() => setQrInput(row.qrRef)}
                                  className="inline-flex items-center gap-1 text-upwa-blue-700 font-semibold hover:underline"
                                >
                                  <QrCode className="w-3.5 h-3.5" /> Inspect QR ({row.qrRef})
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Cryptographic Public QR Verification Simulator */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm grid md:grid-cols-12 gap-6 items-center">
                <div className="md:col-span-6 space-y-3">
                  <span className="text-xs font-semibold text-upwa-blue-700 uppercase">
                    Public Verification Endpoint (/verify/[reference])
                  </span>
                  <h3 className="text-lg font-bold">Cryptographic Report Card Verification</h3>
                  <p className="text-xs text-slate-600">
                    Exposes only minimum approved verification metadata (`valid`, `revoked`, `superseded`, `not found`), never full private transcripts.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={qrInput}
                      onChange={(e) => setQrInput(e.target.value)}
                      placeholder="Enter Document Reference..."
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                    />
                    <span className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1">
                      <Search className="w-3.5 h-3.5" /> Verify
                    </span>
                  </div>
                </div>

                <div className="md:col-span-6 bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs space-y-2">
                  {verifiedRecord ? (
                    <>
                      <div className="flex items-center gap-2 text-upwa-green-700 font-bold">
                        <CheckCircle2 className="w-4 h-4" />
                        STATUS: VALID ISSUANCE (HMAC-SHA256 VERIFIED)
                      </div>
                      <p>
                        <strong>Issuer:</strong> UPWA International Schools (UPWA-ISMS)
                      </p>
                      <p>
                        <strong>Document Ref:</strong> {verifiedRecord.qrRef} (Version 1)
                      </p>
                      <p>
                        <strong>Student ID:</strong> {verifiedRecord.admissionNo} ({verifiedRecord.className})
                      </p>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-rose-700 font-bold">
                      <AlertTriangle className="w-4 h-4" />
                      STATUS: NOT FOUND OR SUPERSEDED
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: FULL SCHOOL FINANCIAL TRACKER */}
          {activeTab === "FINANCE" && (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <h2 className="text-lg font-bold">Manual Bank Transfer Reconciliation</h2>
                <p className="text-xs text-slate-600">
                  Policy Enforcement: Proof-of-payment upload alone NEVER marks an invoice paid. Bursar bank-statement matching is mandatory before issuing a unique PDF e-receipt.
                </p>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="font-semibold">Invoice #INV-2026-0892</span>
                    <span className="font-mono">₦185,000.00</span>
                  </div>
                  <p className="text-slate-600">
                    Student: Tamunoemi Briggs (Primary 5A) • Transfer Ref: NIP/20261123/8821
                  </p>
                  <div className="pt-2 flex items-center justify-between">
                    <span
                      className={`px-2.5 py-1 rounded-full font-semibold ${
                        receiptVerified
                          ? "bg-upwa-green-100 text-upwa-green-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {receiptVerified
                        ? "RECONCILED • E-RECEIPT #RCT-2026-504 ISSUED"
                        : "AWAITING BURSAR STATEMENT MATCH"}
                    </span>
                    {!receiptVerified && (
                      <button
                        onClick={() => setReceiptVerified(true)}
                        className="px-3 py-1.5 rounded-lg bg-upwa-blue-600 text-white font-semibold hover:bg-upwa-blue-500"
                      >
                        Approve & Issue Receipt
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <h2 className="text-lg font-bold">Immutable Ledger & Reversing-Entry Rule</h2>
                <p className="text-xs text-slate-600">
                  Posted income and expenditure entries cannot be silently edited or deleted. Corrections require an auditable reversing entry linked to the original voucher.
                </p>
                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-xl border border-slate-200 flex justify-between items-center">
                    <div>
                      <p className="font-semibold">GEN-DIESEL-114 • Campus Power Generation</p>
                      <p className="text-slate-500">Division: All Schools • Approved by Bursar & President</p>
                    </div>
                    <span className="font-bold text-rose-700">-₦420,000</span>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-200 flex justify-between items-center">
                    <div>
                      <p className="font-semibold">TUITION-BATCH-19 • Paystack Settlement</p>
                      <p className="text-slate-500">Division: Secondary • Webhook Idempotency Verified</p>
                    </div>
                    <span className="font-bold text-upwa-green-700">+₦2,450,000</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DIGITAL GATE PASS & CHILD PICKUP */}
          {activeTab === "PICKUP" && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-semibold text-upwa-blue-700 uppercase">
                    Division A (Crèche, Nursery & Primary) Security Protocol
                  </span>
                  <h2 className="text-lg font-bold">Digital Gate Pass & Child Release Log</h2>
                  <p className="text-xs text-slate-600">
                    Requires human gate-officer photo verification before release and blocks duplicate checkouts.
                  </p>
                </div>
                <button
                  onClick={handleReleasePupil}
                  className="px-4 py-2.5 rounded-xl bg-upwa-blue-600 hover:bg-upwa-blue-500 text-white text-xs font-semibold"
                >
                  Verify & Log Pickup (Tamunoemi Briggs)
                </button>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
                {pickupLog.map((entry) => (
                  <div key={entry.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50">
                    <div>
                      <p className="font-bold text-slate-900">{entry.pupil}</p>
                      <p className="text-slate-600">Authorized Collector: {entry.guardian}</p>
                    </div>
                    <div className="text-right">
                      <span className="px-2.5 py-0.5 rounded-full bg-upwa-green-100 text-upwa-green-800 font-semibold">
                        {entry.status} • {entry.time}
                      </span>
                      <p className="text-slate-500 mt-1">{entry.officer}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: ONLINE ADMISSIONS */}
          {activeTab === "ADMISSIONS" && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm max-w-2xl space-y-4">
              <h2 className="text-lg font-bold">2026/2027 Digital Admissions Application</h2>
              <p className="text-xs text-slate-600">
                Generates a unique Application ID, schedules entrance examinations, and converts approved applicants into permanent longitudinal student records.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setAdmissionSubmitted("APP-UPWA-2026-00419");
                }}
                className="space-y-3 text-xs"
              >
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">Target Division</label>
                    <select className="w-full px-3 py-2 rounded-xl border border-slate-300">
                      <option>Division A: Early Years / Primary</option>
                      <option>Division B: Secondary (JSS1 - SSS3)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Entry Class</label>
                    <input
                      type="text"
                      defaultValue="JSS 1"
                      required
                      className="w-full px-3 py-2 rounded-xl border border-slate-300"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Applicant Full Name</label>
                  <input
                    type="text"
                    placeholder="Surname, First Name, Middle Name"
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-upwa-navy text-white font-semibold hover:bg-slate-800"
                >
                  Submit Application & Generate Exam Slip
                </button>
              </form>

              {admissionSubmitted && (
                <div className="p-4 rounded-xl bg-upwa-green-50 border border-upwa-green-200 text-xs text-upwa-green-900">
                  <strong>Application Registered:</strong> Reference{" "}
                  <span className="font-mono font-bold">{admissionSubmitted}</span>. Entrance exam slip queued for download.
                </div>
              )}
            </div>
          )}
        </main>
      )}

      {/* Mandatory Unobtrusive Institutional & Technology Partner Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            <strong className="text-slate-800">{INSTITUTION_CONFIG.institutionalWebsiteName}</strong>{" "}
            • {INSTITUTION_CONFIG.officialPlatformFullName} ({INSTITUTION_CONFIG.officialShortName})
          </div>
          <div>{INSTITUTION_CONFIG.technologyCredit}</div>
        </div>
      </footer>
    </div>
  );
}
