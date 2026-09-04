/**
 * Postgres reads and writes for goals, 360° reviews and calibration.
 *
 * The only module that knows these column names. Employee ids are the app's
 * ids, which for rows created before the migration are `legacy_id` and
 * otherwise the uuid — the same resolution every other repo here does.
 */

import { supabase } from "./supabase";
import type { Goal, Review360, CalibrationSession } from "./performanceAdvanced";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: string) => UUID_RE.test(v);
const idFilter = (v: string): [string, string] => (isUuid(v) ? ["id", v] : ["legacy_id", v]);
const appId = (row: { id: string; legacy_id?: string | null }) => row.legacy_id ?? row.id;

async function employeeUuid(id?: string): Promise<string | null> {
  if (!id) return null;
  const { data } = await supabase
    .from("employees")
    .select("id")
    .eq(...idFilter(id))
    .maybeSingle();
  return data?.id ?? null;
}

async function employeeAppIds(): Promise<Map<string, string>> {
  const { data } = await supabase.from("employees").select("id, legacy_id");
  const m = new Map<string, string>();
  for (const r of (data ?? []) as { id: string; legacy_id: string | null }[]) {
    m.set(r.id, r.legacy_id ?? r.id);
  }
  return m;
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export const GoalRepo = {
  async list(): Promise<Goal[]> {
    const [{ data, error }, employees] = await Promise.all([
      supabase
        .from("performance_goals")
        .select(
          "id, legacy_id, employee_id, title, description, category, due_date, progress, status, reviewer_id, reviewer_notes",
        )
        .order("due_date", { nullsFirst: false }),
      employeeAppIds(),
    ]);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: appId(row as { id: string; legacy_id: string | null }),
      employeeId: employees.get(row.employee_id as string) ?? (row.employee_id as string),
      title: row.title as string,
      description: (row.description as string) ?? "",
      category: row.category as Goal["category"],
      dueDate: (row.due_date as string) ?? "",
      progress: Number(row.progress ?? 0),
      status: row.status as Goal["status"],
      reviewerId: (row.reviewer_id as string) ?? undefined,
      reviewerNotes: (row.reviewer_notes as string) ?? undefined,
    }));
  },

  async upsert(goal: Goal): Promise<Goal> {
    const employee = await employeeUuid(goal.employeeId);
    if (!employee) throw new Error("That employee could not be found.");

    const payload = {
      employee_id: employee,
      title: goal.title,
      description: goal.description ?? "",
      category: goal.category,
      due_date: goal.dueDate || null,
      progress: goal.progress ?? 0,
      status: goal.status,
      reviewer_notes: goal.reviewerNotes ?? null,
    };

    const { data: existing } = await supabase
      .from("performance_goals")
      .select("id")
      .eq(...idFilter(goal.id))
      .maybeSingle();

    if (existing) {
      // `select()` matters: row level security filters an update the caller may
      // not make rather than rejecting it, so without asking for the row back
      // the screen says "saved" while nothing changed.
      const { data, error } = await supabase
        .from("performance_goals")
        .update(payload)
        .eq("id", existing.id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!data?.length) throw new Error("You do not have permission to change that goal.");
    } else {
      const { data, error } = await supabase
        .from("performance_goals")
        .insert({ ...payload, legacy_id: isUuid(goal.id) ? null : goal.id })
        .select("id");
      if (error) throw new Error(error.message);
      if (!data?.length) throw new Error("You need edit access to performance to add a goal.");
    }
    return goal;
  },

  async remove(id: string): Promise<void> {
    const { data, error } = await supabase
      .from("performance_goals")
      .delete()
      .eq(...idFilter(id))
      .select("id");
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error("You do not have permission to delete that goal.");
  },
};

// ---------------------------------------------------------------------------
// 360° reviews
//
// Read back only where the policy allows: your own submissions, or all of them
// with full access. A short list is not an error — it is the point.
// ---------------------------------------------------------------------------

export const Review360Repo = {
  async list(): Promise<Review360[]> {
    const [{ data, error }, employees] = await Promise.all([
      supabase
        .from("reviews_360")
        .select("id, legacy_id, employee_id, reviewer_id, relationship, ratings, strengths, improvements, submitted_at")
        .order("submitted_at", { ascending: false }),
      employeeAppIds(),
    ]);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: appId(row as { id: string; legacy_id: string | null }),
      employeeId: employees.get(row.employee_id as string) ?? (row.employee_id as string),
      reviewerId: (row.reviewer_id as string) ?? "",
      relationship: row.relationship as Review360["relationship"],
      ratings: (row.ratings as Record<string, number>) ?? {},
      strengths: (row.strengths as string[]) ?? [],
      improvements: (row.improvements as string[]) ?? [],
      submittedAt: row.submitted_at as string,
    }));
  },

  /** Reviews are written once. The reviewer and the time are set by the server. */
  async submit(review: Review360): Promise<Review360> {
    const employee = await employeeUuid(review.employeeId);
    if (!employee) throw new Error("That employee could not be found.");

    const { data, error } = await supabase
      .from("reviews_360")
      .insert({
        legacy_id: isUuid(review.id) ? null : review.id,
        employee_id: employee,
        relationship: review.relationship,
        ratings: review.ratings ?? {},
        strengths: review.strengths ?? [],
        improvements: review.improvements ?? [],
      })
      .select("id");
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error("You need access to performance to submit a review.");
    return review;
  },
};

// ---------------------------------------------------------------------------
// Calibration
// ---------------------------------------------------------------------------

export const CalibrationRepo = {
  async list(): Promise<CalibrationSession[]> {
    const { data, error } = await supabase
      .from("calibration_sessions")
      .select("id, legacy_id, name, department_id, start_date, end_date, participants, final_ratings, notes")
      .order("start_date", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: appId(row as { id: string; legacy_id: string | null }),
      name: row.name as string,
      departmentId: (row.department_id as string) ?? undefined,
      startDate: (row.start_date as string) ?? "",
      endDate: (row.end_date as string) ?? "",
      participants: (row.participants as string[]) ?? [],
      finalRatings: (row.final_ratings as Record<string, number>) ?? {},
      notes: (row.notes as Record<string, string>) ?? {},
    }));
  },

  async upsert(session: CalibrationSession): Promise<CalibrationSession> {
    const payload = {
      name: session.name,
      department_id: session.departmentId || null,
      start_date: session.startDate || null,
      end_date: session.endDate || null,
      participants: session.participants ?? [],
      final_ratings: session.finalRatings ?? {},
      notes: session.notes ?? {},
    };

    const { data: existing } = await supabase
      .from("calibration_sessions")
      .select("id")
      .eq(...idFilter(session.id))
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from("calibration_sessions")
        .update(payload)
        .eq("id", existing.id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!data?.length) throw new Error("You need full access to performance to change a session.");
    } else {
      const { data, error } = await supabase
        .from("calibration_sessions")
        .insert({ ...payload, legacy_id: isUuid(session.id) ? null : session.id })
        .select("id");
      if (error) throw new Error(error.message);
      if (!data?.length) throw new Error("You need full access to performance to start a session.");
    }
    return session;
  },

  async remove(id: string): Promise<void> {
    const { data, error } = await supabase
      .from("calibration_sessions")
      .delete()
      .eq(...idFilter(id))
      .select("id");
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error("You need full access to performance to delete a session.");
  },
};
