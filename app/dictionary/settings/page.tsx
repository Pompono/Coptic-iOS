"use client";
import { useEffect,useState } from 'react';
import Link from '@/lib/AppLink';
import { COPTIC_ALPHABET } from '@/lib/dictionary/search.mjs';
import { readDictionaryOptions,writeDictionaryOptions,defaultDictionaryOptions,type DictionaryOptions } from '@/lib/dictionary/preferences';
import { isBohairicOnlyEnabled } from '@/app/BohairicPreference';
import { loadReadingDictionary } from '@/lib/reading/dictionary';
export default function AdvancedDictionarySettings(){
 const [options,setOptions]=useState(defaultDictionaryOptions),[locked,setLocked]=useState(true),[parts,setParts]=useState<string[]>([]),[error,setError]=useState('');
 useEffect(()=>{const global=isBohairicOnlyEnabled();setLocked(global);const saved=readDictionaryOptions();setOptions({...saved,bohairicOnly:global||saved.bohairicOnly});let cancelled=false;loadReadingDictionary().then(entries=>{if(!cancelled)setParts([...new Set(entries.map(e=>(e.pos??'').trim()).filter(Boolean))].sort());}).catch(()=>{if(!cancelled)setError('Parts of speech could not be loaded. Other search settings remain available.');});return()=>{cancelled=true;};},[]);
 function update(change:Partial<DictionaryOptions>){const next={...options,...change};setOptions(next);try{writeDictionaryOptions(next);setError('');}catch{setError('Could not save dictionary settings.');}}
 const selectClass='w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] px-3 py-3 text-[var(--text-color)]';
 return <main className="app-page dictionary-settings" style={{maxWidth:680,margin:'0 auto',paddingBottom:32}}>
  <Link href="/dictionary/" className="inline-flex min-h-11 items-center text-sm underline">← Back to dictionary</Link>
  <h1 className="mt-3 text-3xl font-semibold">Advanced dictionary settings</h1>
  <p className="mt-2 text-[var(--text-muted)]">Fine-tune your search. Changes apply when you return to the dictionary.</p>
  <section className="mt-5 grid gap-5 rounded-3xl border border-[var(--border-color)] bg-[var(--surface-1)] p-5">
   <label className="grid gap-2 text-sm font-semibold">Search in<select aria-label="Search in" value={options.scope} onChange={e=>update({scope:e.target.value})} className={selectClass}><option value="all">All fields</option><option value="coptic">Coptic words</option><option value="english">English meanings</option><option value="transliteration">Transliteration</option></select></label>
   <label className="grid gap-2 text-sm font-semibold">Initial letter<select aria-label="Initial letter" value={options.initial} onChange={e=>update({initial:e.target.value})} className={`coptic-text ${selectClass}`}><option value="">All letters</option>{Array.from(COPTIC_ALPHABET).map(letter=><option key={letter} value={letter}>{letter}</option>)}</select></label>
   <label className="grid gap-2 text-sm font-semibold">Part of speech<select aria-label="Part of speech" value={options.pos} onChange={e=>update({pos:e.target.value})} className={selectClass}><option value="All">All parts of speech</option>{parts.map(pos=><option key={pos} value={pos}>{pos==='q'?'Qualitative':pos}</option>)}</select></label>
   <div className="grid gap-2 border-t border-[var(--border-color)] pt-3">
    <label className="flex min-h-11 items-center justify-between gap-4 text-sm">Search without combining marks<input type="checkbox" checked={options.ignoreMarks} onChange={e=>update({ignoreMarks:e.target.checked})}/></label>
    <label className="flex min-h-11 items-center justify-between gap-4 text-sm">Spelling suggestions<input type="checkbox" checked={options.suggestions} onChange={e=>update({suggestions:e.target.checked})}/></label>
    <label className="flex min-h-11 items-center justify-between gap-4 text-sm">Has examples<input type="checkbox" checked={options.examplesOnly} onChange={e=>update({examplesOnly:e.target.checked})}/></label>
    <label className="flex min-h-11 items-center justify-between gap-4 text-sm">Bohairic-only<input type="checkbox" disabled={locked} checked={options.bohairicOnly} onChange={e=>update({bohairicOnly:e.target.checked})}/></label>
    {locked&&<p className="text-sm text-[var(--text-muted)]">Bohairic-only is locked by the global setting.</p>}
   </div>
   <p className="text-sm text-[var(--text-muted)]">Transliteration accepts spellings such as agape, agapi, and agapee. It is an approximate typing aid.</p>
   <button type="button" className="min-h-11 rounded-xl border border-[var(--border-color)] p-3 text-sm" onClick={()=>update({...defaultDictionaryOptions,bohairicOnly:locked})}>Reset search settings</button>
  </section>
  {error&&<p role="alert" className="mt-4">{error}</p>}
  <Link href="/dictionary/" className="mt-5 flex min-h-12 items-center justify-center rounded-2xl bg-[var(--accent-color)] p-4 font-semibold text-[var(--accent-contrast-color)]">Done</Link>
 </main>;
}
