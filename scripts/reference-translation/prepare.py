"""Build an attributed, pinned offline parallel-text reference (no training)."""
import csv, hashlib, io, json, urllib.request
from pathlib import Path
REPO = 'megalaa/coptic-corpora'
revision = '5b836707150687b46667fc5a0a596e9f4b3cd11d'
rows = []
sources = []
for name in ['tasbeha_train.csv', 'tasbeha_test.csv']:
    url = f'https://huggingface.co/datasets/{REPO}/resolve/{revision}/{name}'
    with urllib.request.urlopen(url, timeout=30) as r:
        content = r.read()
    sources.append({'file': name, 'sha256': hashlib.sha256(content).hexdigest(), 'url': url})
    for line, row in enumerate(csv.DictReader(io.StringIO(content.decode('utf-8'))), 2):
        coptic, english = row['cop_boh'].strip(), row['en'].strip()
        if coptic and english:
            rows.append([coptic, english, name, line])
root = Path('public/reference-translation')
root.mkdir(parents=True, exist_ok=True)
(root / 'bohairic.json').write_text(json.dumps({'version': 1, 'revision': revision, 'rows': rows, 'selectedRows': json.loads(Path('scripts/reference-translation/selections.json').read_text())['selectedRows']}, ensure_ascii=False, separators=(',', ':')))
(root / 'SOURCE.json').write_text(json.dumps({'dataset': REPO, 'revision': revision, 'license': 'CC-BY-4.0', 'attribution': 'megalaa, Coptic Corpora; source field Tasbeha', 'sources': sources, 'notes': 'Published aligned text, not an independently certified translation. Both original training/test splits are used as a reference library, not as evaluation or new model training.'}, indent=2))
(root / 'LICENSE.txt').write_text('Coptic Corpora by megalaa, source field Tasbeha.\nDataset: https://huggingface.co/datasets/megalaa/coptic-corpora\nLicensed under Creative Commons Attribution 4.0 International.\nhttps://creativecommons.org/licenses/by/4.0/\nChanges: selected Coptic/English rows, retained source row identifiers; packaged as JSON.\n')
print(f'Prepared {len(rows)} reference rows at revision {revision}')
