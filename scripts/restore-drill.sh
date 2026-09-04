#!/usr/bin/env bash
#
# Prove you can restore this database.
#
# Takes a dump, restores it into a scratch database beside the original, and
# compares the two. Nothing is destroyed: the drill runs alongside live data,
# which is the only way anybody will actually run it.
#
# It answers "would a restore work", not "are the hosted backups good". Those
# are different questions and the second needs a real restore of a real backup
# on the provider — see DEPLOYMENT.md step 12.
#
# Usage:
#   scripts/restore-drill.sh                       # against the local stack
#   DB_CONTAINER=supabase_db_bos scripts/restore-drill.sh
#
set -euo pipefail

CONTAINER="${DB_CONTAINER:-supabase_db_bos}"
SOURCE_DB="${SOURCE_DB:-postgres}"
SCRATCH_DB="restore_drill_$(date +%Y%m%d_%H%M%S)"
DUMP="/tmp/${SCRATCH_DB}.dump"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
psql_src() { docker exec -i "$CONTAINER" psql -U postgres -d "$SOURCE_DB" -tAc "$1"; }
psql_dst() { docker exec -i "$CONTAINER" psql -U postgres -d "$SCRATCH_DB" -tAc "$1"; }

# What we compare. Row counts alone would miss the things that make a restore
# dangerous rather than merely incomplete — a database whose policies did not
# come back is readable by everyone.
metrics() {
  local db="$1"
  docker exec -i "$CONTAINER" psql -U postgres -d "$db" -tA -F'=' <<'SQL'
select 'rows', coalesce((select sum(cnt) from (
  select (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I','public',tablename), false, true, '')))[1]::text::int as cnt
  from pg_tables where schemaname='public') x), 0)
union all select 'tables', (select count(*) from pg_tables where schemaname='public')
union all select 'auth_users', (select count(*) from auth.users)
union all select 'rls_policies', (select count(*) from pg_policies where schemaname in ('public','storage'))
union all select 'functions', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public')
union all select 'app_triggers', (select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid
  join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname in ('public','auth','storage'))
union all select 'enums', (select count(*) from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype='e')
union all select 'buckets', (select count(*) from storage.buckets)
union all select 'storage_rows', (select count(*) from storage.objects)
union all select 'realtime_tables', (select count(*) from pg_publication_tables where pubname='supabase_realtime')
order by 1;
SQL
}

cleanup() {
  docker exec -i "$CONTAINER" psql -U postgres -d postgres -q \
    -c "drop database if exists ${SCRATCH_DB};" >/dev/null 2>&1 || true
  docker exec -i "$CONTAINER" rm -f "$DUMP" >/dev/null 2>&1 || true
}
trap cleanup EXIT

say "1. Dumping ${SOURCE_DB}"
# The whole database, not just the app schemas. A dump scoped to
# public/auth/storage is tidier — 7 restore errors against about 50 — but it
# silently leaves out the supabase_realtime publication, and an app restored
# without that works in every respect except that nothing arrives live:
# notifications, messages and inbound mail appear only on reload. Noise on
# restore is a much better failure than a quiet one.
docker exec -i "$CONTAINER" pg_dump -U postgres -d "$SOURCE_DB" --format=custom --file="$DUMP"
docker exec -i "$CONTAINER" ls -lh "$DUMP" | awk '{print "   dump: " $5}'

say "2. Restoring into ${SCRATCH_DB}"
docker exec -i "$CONTAINER" psql -U postgres -d postgres -q -c "create database ${SCRATCH_DB};"
# Errors are expected and mostly harmless: Supabase's own extensions and
# managed schemas cannot be recreated in a second database. What matters is
# whether the application's own objects arrived, which is what step 3 checks.
docker exec -i "$CONTAINER" sh -c "pg_restore -U postgres -d ${SCRATCH_DB} --no-owner ${DUMP} 2>/tmp/${SCRATCH_DB}.err" || true
echo "   platform errors ignored: $(docker exec -i "$CONTAINER" sh -c "grep -c '^pg_restore: error' /tmp/${SCRATCH_DB}.err || true")"

say "3. Comparing"
before=$(metrics "$SOURCE_DB")
after=$(metrics "$SCRATCH_DB")
failed=0
while IFS='=' read -r key expected; do
  actual=$(echo "$after" | grep "^${key}=" | cut -d= -f2)
  if [ "$expected" = "$actual" ]; then
    printf '   %-16s %s\n' "$key" "$expected"
  else
    printf '   %-16s \033[31mexpected %s, got %s\033[0m\n' "$key" "$expected" "$actual"
    failed=1
  fi
done <<< "$before"

say "4. Does row level security still enforce?"
# Counting policies is not the same as their working. This asks the restored
# database a question only a correct policy answers.
# Somebody who genuinely lacks settings access. Picking any user would risk
# choosing an administrator, for whom the question below is vacuous.
subject=$(psql_src "select u.id from auth.users u join public.profiles p on p.id=u.id
  where p.role_id is null or not exists (
    select 1 from public.role_access ra
    where ra.role_id=p.role_id and ra.module='settings' and ra.level='full')
  limit 1;" | head -1)
if [ -n "$subject" ]; then
  # psql prints BEGIN and ROLLBACK even with -tA, so take the numeric line
  # rather than the last one.
  leaked=$(docker exec -i "$CONTAINER" psql -U postgres -d "$SCRATCH_DB" -tA 2>/dev/null <<SQL | grep -E '^[0-9]+$' | tail -1
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','${subject}','role','authenticated')::text, true);
select count(*) from public.audit_log;
rollback;
SQL
)
  # A signed-in user without settings access must see no audit rows at all.
  # Anything else means the policies restored as decoration.
  if [ "$leaked" = "0" ]; then
    echo "   audit log invisible to a user without settings access — policies are live"
  else
    printf '   \033[31mthe audit log was readable without permission — policies did not restore\033[0m\n'
    failed=1
  fi
fi

say "5. What this drill does NOT cover"
cat <<'NOTE'
   Files. storage.objects rows restore; the files they point at do not, because
   they live in object storage rather than in Postgres. A restored database
   believes every attachment, employee document and logo still exists. Back the
   bucket up separately, and restore it alongside.
NOTE

if [ "$failed" -eq 0 ]; then
  say "Restore drill passed."
else
  say "Restore drill FAILED — see the red lines above."
  exit 1
fi
