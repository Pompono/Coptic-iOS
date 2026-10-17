"""Verify the built app, not just source configuration. No signing required."""
import json
import plistlib
import sys
from pathlib import Path
app = Path(sys.argv[1])
with (app / 'PrivacyInfo.xcprivacy').open('rb') as file:
    manifest = plistlib.load(file)
assert any(entry['NSPrivacyAccessedAPIType'] == 'NSPrivacyAccessedAPICategoryFileTimestamp'
           and 'C617.1' in entry['NSPrivacyAccessedAPITypeReasons']
           for entry in manifest['NSPrivacyAccessedAPITypes']), 'Filesystem privacy declaration missing from built app'
config = json.loads((app / 'capacitor.config.json').read_text())
assert {'FilesystemPlugin', 'SharePlugin'} <= set(config['packageClassList']), 'Backup plugins not registered'
with (app / 'Info.plist').open('rb') as file:
    info = plistlib.load(file)
assert info['MinimumOSVersion'] == '14.0', 'Unexpected change to iOS deployment target'
print('PASS: built app contains privacy manifest, backup plugin registration and iOS 14 deployment target.')
