"""Concurrent sessions inside the replay runner's network-disabled container."""
import subprocess
import time


def run(container):
    def start(sql, name, hold=False):
        command = ["docker", "exec", "-i", "-e", f"PGAPPNAME={name}", container,
                   "psql", "-XqAt", "-U", "postgres", "-v", "ON_ERROR_STOP=1"]
        process = subprocess.Popen(command + ([] if hold else ["-c", sql]),
                                   stdin=subprocess.PIPE if hold else None,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if hold:
            process.stdin.write((sql + "\n").encode())
            process.stdin.flush()
        return process

    def finish(process, success=True):
        out, _ = process.communicate(input=b"commit;\n" if process.stdin else None, timeout=20)
        assert (process.returncode == 0) == success, "Concurrent replay SQL failed"
        return out.decode().strip()

    def sql(query):
        return finish(start(query, "replay-observer"))

    def wait(name, event):
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            if sql(f"select exists(select 1 from pg_stat_activity where application_name='{name}' "
                   f"and (lower(wait_event)='{event}' or state='{event}'))") == "t":
                return
            time.sleep(.05)
        raise AssertionError("Concurrent replay did not reach expected lock")

    a = "00000000-0000-4000-8000-0000000000c4"
    b = "00000000-0000-4000-8000-0000000000d5"
    sql(f"insert into auth.users(id) values ('{a}'),('{b}')")
    writer = start(f"begin; insert into public.reviews(user_id,key,prompt,due_at) "
                   f"values ('{a}','race','probe',now());", "replay-writer", hold=True)
    wait("replay-writer", "idle in transaction")
    claim = start(f"select public.claim_account_deletion('{a}',repeat('c',64))", "replay-claim")
    wait("replay-claim", "advisory")
    finish(writer)
    assert finish(claim) == "t"
    sql(f"delete from auth.users where id='{a}'")
    assert sql(f"select count(*) from public.reviews where user_id='{a}'") == "0"
    claim = start(f"begin; select public.claim_account_deletion('{b}',repeat('d',64));",
                  "replay-claim-first", hold=True)
    wait("replay-claim-first", "idle in transaction")
    writer = start(f"set role authenticated; select set_config('request.jwt.claims',"
                   f"'{{\"sub\":\"{b}\"}}',false); select * from public.save_progress_snapshot(0,'{{}}')",
                   "replay-rpc")
    wait("replay-rpc", "advisory")
    finish(claim)
    finish(writer, False)
    assert sql(f"select count(*) from public.progress_sync_snapshots where user_id='{b}'") == "0"
    sql(f"delete from auth.users where id='{b}'")
