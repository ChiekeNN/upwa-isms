import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import PortalWorkspace from "./portal-workspace";

export default async function PortalPage() {
  // Unauthenticated visitors are sent to a static, read-only demo that never queries school data.
  // Authenticated visitors continue to the protected, role-scoped live workspace.
  if (!isSupabaseConfigured()) redirect("/demo-portal");

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/demo-portal");
  return <PortalWorkspace />;
}
