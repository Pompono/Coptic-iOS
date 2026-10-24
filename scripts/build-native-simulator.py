"""Build the disposable simulator app with Xcode's simulated entitlements."""
import plistlib
import subprocess
import tempfile
from pathlib import Path

# Simulator entitlement lookup uses sections generated at link time. Adding a
# signature after an unsigned build does not supply those simulated sections.
# These settings apply only to this command, never the Release device build.
with tempfile.TemporaryDirectory(prefix='coptic-smoke-build-') as temporary:
    entitlements = Path(temporary) / 'simulator.entitlements'
    identifier = 'COPTICCI00.com.pompono.coptic'
    with entitlements.open('wb') as output:
        plistlib.dump({
            'application-identifier': identifier,
            'keychain-access-groups': [identifier],
        }, output)
    subprocess.run([
        'xcodebuild', '-project', 'ios/App/App.xcodeproj', '-scheme', 'App',
        '-sdk', 'iphonesimulator', '-destination', 'generic/platform=iOS Simulator',
        '-derivedDataPath', '/tmp/coptic-derived',
        'CODE_SIGNING_ALLOWED=YES', 'CODE_SIGN_IDENTITY=-', 'DEVELOPMENT_TEAM=',
        f'CODE_SIGN_ENTITLEMENTS={entitlements}', 'build',
    ], check=True)
app = Path('/tmp/coptic-derived/Build/Products/Debug-iphonesimulator/App.app')
subprocess.run(['codesign', '--verify', str(app)], check=True)
subprocess.run(['codesign', '--display', '--entitlements', '-', str(app)], check=True)
print('PASS: Xcode simulator build and local signature; no developer certificate or device signing used.')
