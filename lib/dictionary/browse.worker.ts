import {indexSearchEntry,searchDictionary,suggestDictionary} from './search.mjs';
import {prepareBrowseEntries} from './browseData';
import type {BrowseOptions,BrowseResult} from './browseClient';
let prepared:Promise<ReturnType<typeof indexSearchEntry>[]>|null=null;
let lastKey='',lastResult:BrowseResult|null=null;
function loadIndex(){
  return prepared??=Promise.all(['/bohairic_dictionary.json','/coptic_dictionary_combined.json'].map(async path=>{
    const response=await fetch(path,{cache:'force-cache'});
    if(!response.ok)throw new Error('The bundled dictionary could not be loaded.');
    return response.json();
  })).then(([bohairic,combined])=>prepareBrowseEntries(bohairic,combined).map(indexSearchEntry))
    .catch(error=>{prepared=null;throw error;});
}
self.onmessage=async(event:MessageEvent<{id:number;options:BrowseOptions;offset:number;limit:number}>)=>{
  const {id,options,offset,limit}=event.data;
  try{
    const index=await loadIndex(),key=JSON.stringify(options);
    if(key!==lastKey||!lastResult){
      const allMatches=searchDictionary(index,{...options,pos:''});
      const matches=options.pos?allMatches.filter(entry=>entry.normalizedPos===options.pos):allMatches;
      const hasGoodMatch=matches.some(entry=>entry.matchRank<=12);
      lastResult={entries:matches,total:matches.length,suggestions:options.suggestions&&!hasGoodMatch?suggestDictionary(index,options):[]};
      lastKey=key;
    }
    self.postMessage({id,result:{entries:lastResult.entries.slice(offset,offset+limit),total:lastResult.total,suggestions:lastResult.suggestions}});
  }catch{self.postMessage({id,error:'The bundled dictionary could not be loaded.'});}
};
