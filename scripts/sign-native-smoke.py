"""Give only the disposable simulator app a local identity for Keychain tests."""
import plistlib
import subprocess
import sys
import tempfile
from pathlib import Path

app = Path(sys.argv[1]).resolve()
with (app / 'Info.plist').open('rb') as source:
    info = plistlib.load(source)
assert info.get('DTPlatformName') == 'iphonesimulator', 'Never sign the device IPA with the CI identity'
identifier = 'COPTICCI00.' + info['CFBundleIdentifier']
# No certificate, developer account, or provisioning profile is used. The
# simulator still needs signed app/access-group entitlements to use Keychain.
with tempfile.TemporaryDirectory(prefix='coptic-smoke-signing-') as temporary:
    entitlements = Path(temporary) / 'simulator.entitlements'
    with entitlements.open('wb') as output:
        plistlib.dump({
            'application-identifier': identifier,
            'com.apple.developer.team-identifier': 'COPTICCI00',
            'keychain-access-groups': [identifier],
        }, output)
    subprocess.run(['codesign', '--force', '--sign', '-', '--entitlements', str(entitlements), str(app)], check=True)
    subprocess.run(['codesign', '--verify', str(app)], check=True)
    subprocess.run(['codesign', '--display', '--entitlements', '-', '--verbose=2', str(app)], check=True)
print('PASS: disposable simulator app has a local signature and Keychain access group; device build remains unsigned.')
