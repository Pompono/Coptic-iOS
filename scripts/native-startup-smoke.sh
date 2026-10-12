#!/bin/bash
set -euo pipefail
runtime=$(xcrun simctl list runtimes --json | python3 -c 'import json,sys; r=[x for x in json.load(sys.stdin)["runtimes"] if x.get("isAvailable") and ".iOS-" in x["identifier"]]; print(r[-1]["identifier"])')
device=$(xcrun simctl create CopticStartupSmoke com.apple.CoreSimulator.SimDeviceType.iPhone-16 "$runtime")
cleanup() { xcrun simctl shutdown "$device" >/dev/null 2>&1 || true; xcrun simctl delete "$device" >/dev/null 2>&1 || true; }
trap cleanup EXIT
xcrun simctl boot "$device"
xcrun simctl bootstatus "$device" -b
xcrun simctl install "$device" /tmp/coptic-derived/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch --terminate-running-process --stdout=/tmp/coptic-native-stdout.log --stderr=/tmp/coptic-native-stderr.log "$device" com.pompono.coptic
for attempt in $(seq 1 20); do
  if rg -q COPTIC_SCROLL_BOUNDS_READY /tmp/coptic-native-stdout.log; then
    echo 'PASS: native iOS app launched and configured its bounded scroll view.'
    exit 0
  fi
  sleep 2
done
cat /tmp/coptic-native-stdout.log /tmp/coptic-native-stderr.log
echo 'Native startup did not reach the scroll controller.' >&2
exit 1
