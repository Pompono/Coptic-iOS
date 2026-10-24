// Bundle the real backup functions for the disposable Debug simulator fixture.
// Manual import/export is intentionally absent from the current Settings UI.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import webpackModule from 'next/dist/compiled/webpack/webpack.js';

const temporary = path.resolve('.next/native-backup-smoke');
await mkdir(temporary, { recursive: true });
await writeFile(path.join(temporary, 'loader.cjs'), `const ts = require('typescript'); module.exports = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText;`);
await writeFile(path.join(temporary, 'entry.mjs'), `import * as storage from '../../lib/progressStorage.ts'; import { saveProgressFile } from '../../lib/progressFiles.ts'; window.__nativeBackupApi = { ...storage, saveProgressFile };`);
const { webpack } = webpackModule;
await new Promise((resolve, reject) => {
  const compiler = webpack({
    mode: 'production', target: ['web', 'es2020'],
    entry: path.join(temporary, 'entry.mjs'),
    output: { path: path.resolve('ios/App/App/public'), filename: 'native-backup-api.js' },
    module: { rules: [{ test: /\.ts$/, type: 'javascript/auto', use: path.join(temporary, 'loader.cjs') }] },
    plugins: [new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 })],
    optimization: { minimize: false },
  });
  compiler.run((error, stats) => compiler.close(() => {
    if (error || stats.hasErrors()) reject(error || new Error(stats.toString({ all: false, errors: true })));
    else resolve();
  }));
});
