import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const EXECUTIVE_ROLES = new Set(["UPWA_PRESIDENT", "EXECUTIVE_BOARD"]);
const SELF_SCOPED_ROLES = new Set(["PARENT_GUARDIAN", "STUDENT"]);

export type PortalAccess = {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  user: { id: string; email?: string };
  divisionCode: string;
  divisionId: string | null;
  roles: { id: string; code: string; label: string; divisionId: string | null }[];
  permissions: string[];
};

export type PortalAccessResult =
  | { ok: true; access: PortalAccess }
  | { ok: false; response: NextResponse };

export async function requirePortalAccess(
  divisionCode: string,
  requiredPermissions: string[] = []
): Promise<PortalAccessResult> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "The school database is not configured yet." },
        { status: 503 }
      ),
    };
  }

  const supabase = await createServerSupabaseClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Sign in required." }, { status: 401 }),
    };
  }

  const [{ data: assignments, error: assignmentsError }, { data: allRoles, error: rolesError }] =
    await Promise.all([
      supabase
        .from("user_roles")
        .select("role_id, division_id")
        .eq("user_id", authData.user.id),
      supabase.from("roles").select("id, code, label"),
    ]);

  if (assignmentsError || rolesError) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Could not load your access assignments. Apply the latest database migrations." },
        { status: 503 }
      ),
    };
  }

  const roleById = new Map((allRoles ?? []).map((role) => [role.id, role]));
  const assigned = (assignments ?? []).flatMap((grant) => {
    const role = roleById.get(grant.role_id);
    return role
      ? [{ id: role.id, code: role.code, label: role.label, divisionId: grant.division_id as string | null }]
      : [];
  });

  let divisionId: string | null = null;
  let matchingRoles: typeof assigned = [];
  if (divisionCode === "*") {
    // Identity metadata only; no school records are queried by this branch.
    matchingRoles = assigned;
  } else if (divisionCode === "ALL") {
    matchingRoles = assigned.filter(
      (role) => role.divisionId === null && (EXECUTIVE_ROLES.has(role.code) || SELF_SCOPED_ROLES.has(role.code))
    );
  } else {
    const { data: division, error: divisionError } = await supabase
      .from("school_divisions")
      .select("id, code")
      .eq("code", divisionCode)
      .maybeSingle();
    if (divisionError || !division) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Unknown school division." }, { status: 400 }),
      };
    }
    divisionId = division.id;
    matchingRoles = assigned.filter(
      (role) => role.divisionId === divisionId || (role.divisionId === null && EXECUTIVE_ROLES.has(role.code))
    );
    // Parents and students may select either school context: RLS still limits every row to their own links.
    matchingRoles.push(
      ...assigned.filter((role) => role.divisionId === null && SELF_SCOPED_ROLES.has(role.code))
    );
  }

  if (matchingRoles.length === 0 && !(divisionCode === "*" && requiredPermissions.length === 0)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Your account has no role for this school context. Ask an authorised school administrator." },
        { status: 403 }
      ),
    };
  }

  const roleIds = Array.from(new Set(matchingRoles.map((role) => role.id)));
  const { data: rolePermissions, error: permissionError } = roleIds.length
    ? await supabase.from("role_permissions").select("permission_code").in("role_id", roleIds)
    : { data: [], error: null };
  if (permissionError) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Could not load permissions. Apply the latest database migrations." },
        { status: 503 }
      ),
    };
  }
  const permissions = Array.from(new Set((rolePermissions ?? []).map((permission) => permission.permission_code)));
  if (requiredPermissions.length && !requiredPermissions.some((permission) => permissions.includes(permission))) {
    return {
      ok: false,
      response: NextResponse.json({ error: "You do not have permission for this action." }, { status: 403 }),
    };
  }

  return {
    ok: true,
    access: {
      supabase,
      user: { id: authData.user.id, email: authData.user.email },
      divisionCode,
      divisionId,
      roles: matchingRoles,
      permissions,
    },
  };
}
