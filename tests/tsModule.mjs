import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
const modules = new Map();
export async function loadTsModule(file) {
  const url = await moduleUrl(path.resolve(file));
  return import(url);
}
async function moduleUrl(file) {
  if (modules.has(file)) return modules.get(file);
  const source = await readFile(file,'utf8');
  let code = ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
  const imports = [...code.matchAll(/from\s+["']([^"']+)["']/gu)];
  for (const match of imports) {
    const name=match[1];
    if (!name.startsWith('@/') && !name.startsWith('.')) continue;
    let dependency=name.startsWith('@/')?path.resolve(name.slice(2)):path.resolve(path.dirname(file),name);
    if (!path.extname(dependency)) dependency += '.ts';
    const url=dependency.endsWith('.ts')?await moduleUrl(dependency):pathToFileURL(dependency).href;
    code=code.replace(match[0], `from ${JSON.stringify(url)}`);
  }
  const url='data:text/javascript;base64,'+Buffer.from(code).toString('base64');modules.set(file,url);return url;
}
