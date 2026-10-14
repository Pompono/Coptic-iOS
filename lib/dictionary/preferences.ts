export type DictionaryOptions = { scope:string; initial:string; pos:string; examplesOnly:boolean; bohairicOnly:boolean; ignoreMarks:boolean; suggestions:boolean };
export const defaultDictionaryOptions: DictionaryOptions = { scope:'all',initial:'',pos:'All',examplesOnly:false,bohairicOnly:false,ignoreMarks:true,suggestions:true };
export function readDictionaryOptions(): DictionaryOptions {
  const options={...defaultDictionaryOptions};
  if(typeof window==='undefined')return options;
  try {
    const session=JSON.parse(sessionStorage.getItem('coptic-dictionary-search')??'null');
    const preferences=JSON.parse(localStorage.getItem('coptic-dictionary-preferences')??'null');
    if(['all','coptic','english','transliteration'].includes(session?.scope))options.scope=session.scope;
    if(typeof session?.initial==='string')options.initial=session.initial;
    if(typeof session?.pos==='string')options.pos=session.pos;
    if(typeof session?.examplesOnly==='boolean')options.examplesOnly=session.examplesOnly;
    if(typeof session?.bohairicOnly==='boolean')options.bohairicOnly=session.bohairicOnly;
    if(typeof preferences?.ignoreMarks==='boolean')options.ignoreMarks=preferences.ignoreMarks;
    if(typeof preferences?.suggestions==='boolean')options.suggestions=preferences.suggestions;
  }catch{}
  return options;
}
export function writeDictionaryOptions(options:DictionaryOptions) {
  let saved: Record<string,unknown> = {};
  try { const parsed=JSON.parse(sessionStorage.getItem('coptic-dictionary-search')??'null'); if(parsed && typeof parsed==='object' && !Array.isArray(parsed))saved=parsed; } catch { /* Replace damaged preferences while keeping search available. */ }
  sessionStorage.setItem('coptic-dictionary-search',JSON.stringify({...saved,scope:options.scope,initial:options.initial,pos:options.pos,examplesOnly:options.examplesOnly,bohairicOnly:options.bohairicOnly}));
  localStorage.setItem('coptic-dictionary-preferences',JSON.stringify({ignoreMarks:options.ignoreMarks,suggestions:options.suggestions}));
}
