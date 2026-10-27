"""Disposable CI database only: exercise actual concurrent PostgreSQL sessions."""
import os
import subprocess
import time

# Intentionally no configurable target or production connection string.
COMMAND = ["psql", "postgresql://postgres@127.0.0.1:5432/coptic_progress_test",
           "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-c"]


def start(sql, name):
    return subprocess.Popen(COMMAND + [sql], text=True, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, env={**os.environ, "PGAPPNAME": name})


def finish(process, success=True):
    output, error = process.communicate(timeout=15)
    assert (process.returncode == 0) == success, (output, error)
    return output.strip()


def sql(query):
    return finish(start(query, "deletion-race-observer"))


def wait_for(name, event):
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        if sql(f"select exists(select 1 from pg_stat_activity where application_name = '{name}' "
               f"and lower(wait_event) = '{event}')") == "t":
            return
        time.sleep(0.05)
    raise AssertionError(f"Session {name} did not reach {event}")


# Already-running writes finish before claim; their rows then cascade normally.
a = "00000000-0000-4000-8000-0000000000c4"
b = "00000000-0000-4000-8000-0000000000d5"
sql(f"insert into auth.users(id) values ('{a}'), ('{b}')")
writer = start(f"begin; insert into public.reviews(user_id) values ('{a}'); "
               "select pg_sleep(3); commit", "deletion-race-writer")
wait_for("deletion-race-writer", "pgsleep")
claim = start(f"select public.claim_account_deletion('{a}', repeat('c', 64))", "deletion-race-claim")
wait_for("deletion-race-claim", "advisory")
finish(writer)
assert finish(claim) == "t"
sql(f"delete from auth.users where id = '{a}'")
assert sql(f"select count(*) from public.reviews where user_id = '{a}'") == "0"

# A writer that arrives during a claim must see the committed deletion fence
# after waiting, including when it began its statement before the claim committed.
claim = start(f"begin; select public.claim_account_deletion('{b}', repeat('d', 64)); "
              "select pg_sleep(3); commit", "deletion-race-claim-first")
wait_for("deletion-race-claim-first", "pgsleep")
writer = start(f"select public.fixture_write_review('{b}')", "deletion-race-rpc")
wait_for("deletion-race-rpc", "advisory")
finish(claim)
finish(writer, success=False)
assert sql(f"select count(*) from public.reviews where user_id = '{b}'") == "0"
sql(f"delete from auth.users where id = '{b}'")
print("Concurrent write/claim and SECURITY DEFINER RPC races passed.")
