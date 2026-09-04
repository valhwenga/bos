import { createCache } from "./collectionCache";
import { RolesRepo } from "./rolesRepo";
import { type Role } from "./modules";

// The permission vocabulary lives in ./modules; re-exported here because most
// of the app has always imported it from this path.
export {
  Modules,
  type AccessLevel,
  type ModuleKey,
  type Role,
  type RoleLevel,
} from "./modules";

/**
 * Roles are rows in Postgres.
 *
 * They always were, as far as enforcement is concerned: `has_access()` reads
 * the roles and role_access tables, and every row level security policy in the
 * database is built on that function. This module kept a separate copy in
 * localStorage, seeded with defaults, and the editor at /users/role wrote to
 * the copy — so an administrator could change a permission, be told it saved,
 * and change nothing the server would honour. Worse, the matrix on screen was
 * the seed rather than what was actually being enforced, so it could not even
 * be trusted as a report.
 *
 * `list()` stays synchronous against the cache so the render-time call sites
 * keep working; writes are async and go to the server.
 */

export const rolesCache = createCache<Role>(() => RolesRepo.list());

export const RolesStore = {
  list(): Role[] {
    return rolesCache.list();
  },
  load(): Promise<Role[]> {
    return rolesCache.ensureLoaded();
  },
  get(id: string): Role | undefined {
    return this.list().find((x) => x.id === id);
  },
  async upsert(role: Role): Promise<Role> {
    await rolesCache.mutate(() => RolesRepo.upsert(role));
    return role;
  },
  async remove(id: string): Promise<void> {
    await rolesCache.mutate(() => RolesRepo.remove(id));
  },
};

/*
 * `canAccess` and `getCurrentRole` deliberately do not live here.
 *
 * They previously existed in both this module and accessControl.ts with
 * opposite failure modes, and which one a call site got depended on its import
 * path. Import them from "@/lib/accessControl" — the single source of truth.
 */
