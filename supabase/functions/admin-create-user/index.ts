/**
 * Creates a user account on behalf of an administrator.
 *
 * Creating somebody else's account needs the service_role key, which bypasses
 * row level security entirely and therefore must never be shipped to a browser.
 * The old code sidestepped this by writing an account object into localStorage
 * with its password in plain text.
 *
 * So the privileged step happens here: the caller presents their own JWT, this
 * function checks that they really do have 'full' access to settings *as the
 * database sees it*, and only then uses the service key to create the user.
 * A caller who fakes an admin role in their browser fails the check.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "Not signed in." }, 401);

  // A client bound to the caller's JWT: has_access() runs as them.
  const asCaller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: caller } = await asCaller.auth.getUser();
  if (!caller?.user) return json({ error: "Not signed in." }, 401);

  const { data: allowed, error: accessError } = await asCaller.rpc("has_access", {
    target_module: "settings",
    required: "full",
  });
  if (accessError) return json({ error: accessError.message }, 500);
  if (allowed !== true) {
    return json({ error: "You need full access to settings to create accounts." }, 403);
  }

  let body: {
    email?: string;
    password?: string;
    name?: string;
    roleId?: string;
    clientId?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Expected a JSON body." }, 400);
  }

  const { email, password, name, roleId, clientId } = body;
  if (!email || !password || !roleId) {
    return json({ error: "email, password and roleId are required." }, 400);
  }
  if (password.length < 8) {
    return json({ error: "Password must be at least 8 characters." }, 400);
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // an administrator vouched for the address
    user_metadata: { name: name ?? "" },
  });
  if (createError) return json({ error: createError.message }, 400);

  const userId = created.user!.id;

  // The on_auth_user_created trigger already inserted a pending profile; an
  // account an administrator created deliberately does not need approving.
  const { error: profileError } = await admin
    .from("profiles")
    .update({
      name: name ?? "",
      role_id: roleId,
      status: "active",
      client_id: clientId ?? null,
    })
    .eq("id", userId);

  if (profileError) {
    // Do not leave an auth user with no usable profile behind.
    await admin.auth.admin.deleteUser(userId);
    return json({ error: profileError.message }, 400);
  }

  return json({ id: userId, email, name: name ?? "", roleId, clientId: clientId ?? null });
});
