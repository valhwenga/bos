/**
 * Postgres reads and writes for roles and their access matrix.
 *
 * These two tables are what `has_access()` reads, and `has_access()` is what
 * every row level security policy in the database is built on. So this is the
 * one repo where a write does not merely record a decision — it changes what
 * the server will allow.
 *
 * The access matrix is a row per module rather than a JSON blob on the role,
 * because the policies join to it.
 */

import { supabase } from "./supabase";
import { Modules, type AccessLevel, type ModuleKey, type Role, type RoleLevel } from "./modules";

type RoleRow = {
  id: string;
  name: string;
  level: RoleLevel;
  description: string | null;
  require_2fa: boolean;
  session_timeout_minutes: number | null;
  is_system: boolean;
};

const emptyAccess = (): Record<ModuleKey, AccessLevel> =>
  Object.fromEntries(Modules.map((m) => [m.key, "none" as AccessLevel])) as Record<ModuleKey, AccessLevel>;

/**
 * The database still carries `whatsapp` in its module enum — see the migration
 * for why it cannot be removed cheaply — so a stray row for a module the app no
 * longer knows about is dropped rather than widening ModuleKey to match.
 */
const KNOWN_MODULES = new Set<string>(Modules.map((m) => m.key));

export const RolesRepo = {
  async list(): Promise<Role[]> {
    const [rolesResult, accessResult] = await Promise.all([
      supabase
        .from("roles")
        .select("id, name, level, description, require_2fa, session_timeout_minutes, is_system")
        .order("is_system", { ascending: false })
        .order("name"),
      supabase.from("role_access").select("role_id, module, level"),
    ]);
    if (rolesResult.error) throw new Error(rolesResult.error.message);
    if (accessResult.error) throw new Error(accessResult.error.message);

    const byRole = new Map<string, Record<ModuleKey, AccessLevel>>();
    for (const row of (accessResult.data ?? []) as { role_id: string; module: string; level: AccessLevel }[]) {
      if (!KNOWN_MODULES.has(row.module)) continue;
      const access = byRole.get(row.role_id) ?? emptyAccess();
      access[row.module as ModuleKey] = row.level;
      byRole.set(row.role_id, access);
    }

    return ((rolesResult.data ?? []) as RoleRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      level: row.level,
      description: row.description ?? undefined,
      // A role with no rows yet grants nothing, which is the safe reading.
      access: byRole.get(row.id) ?? emptyAccess(),
      require2FA: row.require_2fa,
      isSystem: row.is_system,
      security: {
        sessionTimeoutMinutes: row.session_timeout_minutes ?? undefined,
      },
    }));
  },

  async upsert(role: Role): Promise<Role> {
    const { data, error } = await supabase
      .from("roles")
      .upsert(
        {
          id: role.id,
          name: role.name,
          level: role.level,
          description: role.description ?? null,
          require_2fa: role.require2FA ?? false,
          session_timeout_minutes: role.security?.sessionTimeoutMinutes ?? null,
        },
        { onConflict: "id" },
      )
      // Row level security filters a write the caller may not make rather than
      // rejecting it, so without asking for the row back this returns no error
      // and the screen says "Saved" while the server enforces the old matrix.
      .select("id");
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      throw new Error("You need full access to settings to change roles.");
    }

    const rows = Modules.map((m) => ({
      role_id: role.id,
      module: m.key,
      level: role.access[m.key] ?? "none",
    }));
    const { data: accessData, error: accessError } = await supabase
      .from("role_access")
      .upsert(rows, { onConflict: "role_id,module" })
      .select("module");
    if (accessError) throw new Error(accessError.message);
    if (!accessData || accessData.length === 0) {
      throw new Error("The role was saved but its permissions were not. Check your settings access.");
    }

    return role;
  },

  async remove(id: string): Promise<void> {
    // The database refuses this for a built-in role, and raises if anyone still
    // holds it. Both come back as errors the caller shows.
    const { data, error } = await supabase.from("roles").delete().eq("id", id).select("id");
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      throw new Error("That role could not be deleted. Built-in roles are permanent.");
    }
  },
};
