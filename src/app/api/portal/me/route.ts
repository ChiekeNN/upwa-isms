import { NextResponse } from "next/server";
import { requirePortalAccess } from "@/lib/auth/portal-access";

export async function GET() {
  const accessResult = await requirePortalAccess("*");
  if (!accessResult.ok) return accessResult.response;

  const { access } = accessResult;
  const [{ data: profile }, { data: divisions }] = await Promise.all([
    access.supabase
      .from("user_profiles")
      .select("display_name, avatar_path")
      .eq("user_id", access.user.id)
      .maybeSingle(),
    access.supabase.from("school_divisions").select("id, code, name").order("name"),
  ]);
  const hasGlobalExecutive = access.roles.some((role) => role.divisionId === null && ["UPWA_PRESIDENT", "EXECUTIVE_BOARD"].includes(role.code));
  const selfScoped = access.roles.some((role) => role.divisionId === null && ["PARENT_GUARDIAN", "STUDENT"].includes(role.code));
  const assignedDivisionIds = new Set(access.roles.map((role) => role.divisionId).filter(Boolean));
  const allowedDivisions = (divisions ?? []).filter((division) =>
    hasGlobalExecutive || selfScoped || assignedDivisionIds.has(division.id)
  );

  return NextResponse.json({
    user: { id: access.user.id, email: access.user.email ?? null, displayName: profile?.display_name ?? null },
    roles: access.roles.map(({ code, label, divisionId }) => ({ code, label, divisionId })),
    divisions: allowedDivisions,
    permissions: access.permissions,
  });
}
