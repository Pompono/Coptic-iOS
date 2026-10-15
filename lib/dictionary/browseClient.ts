import type {Entry} from './browseData';
export type BrowseEntry = Entry & {matchLabel?:string;matchEvidence?:string};
export type BrowseOptions = {query:string;scope:string;ignoreMarks:boolean;initial:string;bohairicOnly:boolean;examplesOnly:boolean;pos:string;suggestions:boolean};
export type BrowseResult = {entries:BrowseEntry[];total:number;suggestions:string[]};
export const BROWSE_BATCH_SIZE=24;
let worker:Worker|null=null,sequence=0;
let idleTimer:ReturnType<typeof setTimeout>|undefined;
const pending=new Map<number,{resolve:(result:BrowseResult)=>void;reject:(error:Error)=>void}>();
// Keep the small first pages when returning from an entry or search settings.
const firstPages=new Map<string,BrowseResult>();
export function peekBrowseDictionary(options:BrowseOptions){return firstPages.get(JSON.stringify(options));}
export function searchBrowseDictionary(options:BrowseOptions,offset:number):Promise<BrowseResult>{
  const key=JSON.stringify(options);
  if(offset===0&&firstPages.has(key))return Promise.resolve(firstPages.get(key)!);
  return new Promise((resolve,reject)=>{
    try{
      if(!worker){
        worker=new Worker(new URL('./browse.worker.ts',import.meta.url));
        worker.onmessage=event=>{
          const request=pending.get(event.data.id);
          if(!request)return;
          pending.delete(event.data.id);
          if(event.data.error)request.reject(new Error(event.data.error));else request.resolve(event.data.result);
          clearTimeout(idleTimer);
          idleTimer=setTimeout(()=>{if(!pending.size){worker?.terminate();worker=null;}},60000);
        };
        worker.onerror=event=>{
          event.preventDefault();worker?.terminate();worker=null;
          clearTimeout(idleTimer);
          for(const request of pending.values())request.reject(new Error('The dictionary could not load.'));
          pending.clear();
        };
      }
      const id=++sequence;
      clearTimeout(idleTimer);
      pending.set(id,{resolve:result=>{
        if(offset===0){
          firstPages.delete(key);firstPages.set(key,result);
          if(firstPages.size>12)firstPages.delete(firstPages.keys().next().value!);
        }
        resolve(result);
      },reject});
      worker.postMessage({id,options,offset,limit:BROWSE_BATCH_SIZE});
    }catch(error){reject(error instanceof Error?error:new Error('The dictionary could not load.'));}
  });
}
