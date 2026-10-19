#!/bin/bash
set -euo pipefail
bounded() {
  python3 - "$@" <<'PYTHON'
import subprocess, sys
try:
    subprocess.run(sys.argv[2:], check=True, timeout=int(sys.argv[1]))
except subprocess.TimeoutExpired:
    print(f"::error::Native startup timed out after {sys.argv[1]}s: {' '.join(sys.argv[2:])}", flush=True)
    raise
except subprocess.CalledProcessError as failure:
    print(f"::error::Native startup command failed with exit {failure.returncode}: {' '.join(sys.argv[2:])}", flush=True)
    raise
PYTHON
}
runtime=$(bounded 30 xcrun simctl list runtimes --json | python3 -c 'import json,sys; r=[x for x in json.load(sys.stdin)["runtimes"] if x.get("isAvailable") and ".iOS-" in x["identifier"]]; print(r[-1]["identifier"])')
device=$(bounded 60 xcrun simctl create CopticStartupSmoke com.apple.CoreSimulator.SimDeviceType.iPhone-16 "$runtime")
cleanup() { bounded 10 xcrun simctl shutdown "$device" >/dev/null 2>&1 || true; bounded 10 xcrun simctl delete "$device" >/dev/null 2>&1 || true; }
trap cleanup EXIT
bounded 30 xcrun simctl boot "$device"
bounded 15 open -a Simulator --args -CurrentDeviceUDID "$device" || true
bounded 600 xcrun simctl bootstatus "$device" -b 2>&1 | tee /tmp/coptic-native-boot.log
bounded 180 xcrun simctl install "$device" /tmp/coptic-derived/Build/Products/Debug-iphonesimulator/App.app
# Await launch before starting the bridge-check clock. A cold simulator can
# spend most of the launch timeout starting services before the app runs.
SIMCTL_CHILD_COPTIC_NATIVE_AUDIO_SMOKE=1 SIMCTL_CHILD_COPTIC_NATIVE_BACKUP_SMOKE=1 bounded 120 xcrun simctl launch --terminate-running-process --stdout=/tmp/coptic-native-stdout.log --stderr=/tmp/coptic-native-stderr.log "$device" com.pompono.coptic
for attempt in $(seq 1 120); do
  if python3 -c 'from pathlib import Path; import sys; p=Path("/tmp/coptic-native-stdout.log"); sys.exit(0 if p.exists() and "COPTIC_SCROLL_BOUNDS_READY" in p.read_text() and "COPTIC_NATIVE_AUDIO_DECODE_READY" in p.read_text() and "COPTIC_NATIVE_AUDIO_BRIDGE_READY" in p.read_text() and "COPTIC_NATIVE_BACKUP_READY" in p.read_text() and "COPTIC_NATIVE_AUTH_STORAGE_READY" in p.read_text() else 1)'; then
    echo 'PASS: native backup JSON/Unicode, real share-sheet cancellation, import preview/cancel/reject/restore and automatic reload persistence.'
    echo 'PASS: Capacitor native Keychain storage reads, writes, and removes an auth-session-shaped value.'
    echo 'PASS: native iOS app launched, configured scrolling, and decoded and played pronunciation and feedback recordings through the actual Capacitor/AVAudioPlayer bridge.'
    exit 0
  fi
  sleep 2
done
cat /tmp/coptic-native-stdout.log /tmp/coptic-native-stderr.log
python3 - <<'PYTHON'
from pathlib import Path
log = Path('/tmp/coptic-native-stdout.log').read_text()
markers = ['COPTIC_SCROLL_BOUNDS_READY', 'COPTIC_NATIVE_AUDIO_DECODE_READY', 'COPTIC_NATIVE_AUDIO_BRIDGE_READY', 'COPTIC_NATIVE_BACKUP_READY', 'COPTIC_NATIVE_AUTH_STORAGE_READY']
reason = next((line for line in log.splitlines() if 'COPTIC_NATIVE_AUDIO_BRIDGE_ERROR' in line or 'COPTIC_NATIVE_BACKUP_ERROR' in line), 'Missing native startup checks: ' + ', '.join(marker for marker in markers if marker not in log))
print('::error::' + reason.replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A'))
PYTHON
exit 1
