#!/bin/bash
set -euo pipefail
bounded() {
  python3 - "$@" <<'PYTHON'
import subprocess, sys
subprocess.run(sys.argv[2:], check=True, timeout=int(sys.argv[1]))
PYTHON
}
runtime=$(bounded 30 xcrun simctl list runtimes --json | python3 -c 'import json,sys; r=[x for x in json.load(sys.stdin)["runtimes"] if x.get("isAvailable") and ".iOS-" in x["identifier"]]; print(r[-1]["identifier"])')
device=$(bounded 60 xcrun simctl create CopticStartupSmoke com.apple.CoreSimulator.SimDeviceType.iPhone-16 "$runtime")
launch_pid=""
cleanup() { if [ -n "$launch_pid" ]; then kill "$launch_pid" 2>/dev/null || true; fi; bounded 10 xcrun simctl shutdown "$device" >/dev/null 2>&1 || true; bounded 10 xcrun simctl delete "$device" >/dev/null 2>&1 || true; }
trap cleanup EXIT
bounded 30 xcrun simctl boot "$device"
bounded 15 open -a Simulator --args -CurrentDeviceUDID "$device" || true
bounded 420 xcrun simctl bootstatus "$device" -b
bounded 180 xcrun simctl install "$device" /tmp/coptic-derived/Build/Products/Debug-iphonesimulator/App.app
bounded 120 xcrun simctl launch --terminate-running-process --console "$device" com.pompono.coptic > /tmp/coptic-native-stdout.log 2> /tmp/coptic-native-stderr.log &
launch_pid=$!
for attempt in $(seq 1 45); do
  if python3 -c 'from pathlib import Path; import sys; p=Path("/tmp/coptic-native-stdout.log"); sys.exit(0 if p.exists() and "COPTIC_SCROLL_BOUNDS_READY" in p.read_text() and "COPTIC_NATIVE_AUDIO_DECODE_READY" in p.read_text() else 1)'; then
    echo 'PASS: native iOS app launched, configured scrolling, and decoded the bundled recording through AVAudioPlayer.'
    exit 0
  fi
  sleep 2
done
cat /tmp/coptic-native-stdout.log /tmp/coptic-native-stderr.log
echo 'Native startup did not reach the scroll controller.' >&2
exit 1
