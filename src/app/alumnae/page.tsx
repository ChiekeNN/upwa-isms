import Image from "next/image";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { AlumnaeDonationPanel } from "./panel";

export default async function AlumnaeCornerPage() {
  let entries: any[] = []; let campaigns: any[] = [];
  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    const [content, donations] = await Promise.all([
      supabase.from("cms_entries").select("id,content_type,title,summary,body,published_at").in("content_type",["ALUMNAE","SCHOLARSHIP","DEVELOPMENT_PROJECT"]).eq("status","PUBLISHED").eq("is_placeholder",false).order("published_at",{ascending:false}).limit(40),
      supabase.from("donation_campaigns").select("id,campaign_code,title,purpose,target_amount,currency").eq("is_published",true).eq("is_active",true).order("created_at",{ascending:false}).limit(20),
    ]);
    entries=content.data??[]; campaigns=donations.data??[];
  }
  return <main className="min-h-screen bg-upwa-canvas"><header className="border-b bg-white"><div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-5"><Image src="/upwa-logo.png" alt="UPWA International Schools" width={120} height={130} className="h-16 w-auto"/><div><p className="text-xs font-bold uppercase tracking-widest text-upwa-blue-700">UPWA International Schools</p><h1 className="text-2xl font-bold text-upwa-navy">UPWA Alumnae, Scholarships & Endowment Corner</h1></div></div></header><div className="mx-auto max-w-6xl space-y-8 px-5 py-8"><p className="max-w-3xl text-sm leading-6 text-slate-600">A school-approved heritage space for alumnae stories, scholarship initiatives and campus development. Only material verified and published by authorised UPWA editors appears here. Donor identities are not publicly displayed.</p>{entries.length===0?<section className="rounded-2xl border bg-white p-6"><h2 className="font-semibold text-upwa-navy">Stories are being prepared</h2><p className="mt-2 text-sm text-slate-600">No verified alumnae, scholarship or development stories have been published yet. No historical records are assumed or invented.</p></section>:<section className="grid gap-4 md:grid-cols-2">{entries.map((entry)=>{const text=typeof entry.body?.text==="string"?entry.body.text:"";return <article key={entry.id} className="rounded-2xl border bg-white p-6"><p className="text-xs font-semibold uppercase text-upwa-blue-700">{entry.content_type.replaceAll("_"," ")}</p><h2 className="mt-2 text-lg font-bold text-upwa-navy">{entry.title}</h2>{entry.summary&&<p className="mt-2 text-sm font-medium">{entry.summary}</p>}{text&&<p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{text}</p>}</article>})}</section>}<section className="space-y-4"><div><h2 className="text-xl font-bold text-upwa-navy">Support a verified initiative</h2><p className="mt-1 text-sm text-slate-600">Donations use a separate campaign ledger, never student-fee invoices. Only campaigns explicitly approved by UPWA are open.</p></div>{campaigns.length===0?<p className="rounded-xl border bg-white p-5 text-sm text-slate-600">There are no active, approved donation campaigns at this time.</p>:<AlumnaeDonationPanel campaigns={campaigns}/>}</section></div></main>;
}
