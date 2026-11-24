import Link from "next/link";
import { redirect } from "next/navigation";
import Image from "next/image";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import PortalWorkspace from "./portal-workspace";

export default async function PortalPage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="min-h-screen bg-upwa-canvas p-6 flex items-center justify-center">
        <section className="max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <Image src="/upwa-logo.png" alt="UPWA International Schools" width={180} height={200} className="h-16 w-auto object-contain" />
          <h1 className="mt-5 text-xl font-bold text-upwa-navy">Portal setup required</h1>
          <p className="mt-2 text-sm text-slate-600">The school database connection has not been configured for this deployment.</p>
          <Link href="/" className="mt-5 inline-flex rounded-lg bg-upwa-blue-700 px-4 py-2 text-sm font-semibold text-white">Return to public website</Link>
        </section>
      </main>
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");
  return <PortalWorkspace />;
}
