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
assert {'AppPlugin', 'CopticSecureAuthStoragePlugin'} <= set(config['packageClassList']), 'Auth callback or Keychain plugin not registered'
with (app / 'Info.plist').open('rb') as file:
    info = plistlib.load(file)
assert info['MinimumOSVersion'] == '14.0', 'Unexpected change to iOS deployment target'
assert any('com.pompono.coptic' in item.get('CFBundleURLSchemes', [])
           for entry in info.get('CFBundleURLTypes', []) for item in [entry]), 'Native auth callback URL scheme missing'
print('PASS: built app contains privacy manifest, backup and auth plugin registration, native callback scheme, and iOS 14 deployment target.')
