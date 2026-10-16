"use client";
import useSettingsLockNotice from "../../SettingsLockNotice";
import PageHeader, { PageBackLink } from "../../PageHeader";
import { useEffect,useState } from 'react';
import Link from '@/lib/AppLink';
import { COPTIC_ALPHABET } from '@/lib/dictionary/search.mjs';
import { readDictionaryOptions,writeDictionaryOptions,defaultDictionaryOptions,type DictionaryOptions } from '@/lib/dictionary/preferences';
import { isBohairicOnlyEnabled } from '@/app/BohairicPreference';
import { loadReadingDictionary } from '@/lib/reading/dictionary';
export default function AdvancedDictionarySettings(){
 const {show:showLock,notice}=useSettingsLockNotice();
 const [options,setOptions]=useState(defaultDictionaryOptions),[locked,setLocked]=useState(true),[parts,setParts]=useState<string[]>([]),[error,setError]=useState('');
 useEffect(()=>{const global=isBohairicOnlyEnabled();setLocked(global);const saved=readDictionaryOptions();setOptions({...saved,bohairicOnly:global||saved.bohairicOnly});let cancelled=false;loadReadingDictionary().then(entries=>{if(!cancelled)setParts([...new Set(entries.map(e=>(e.pos??'').trim()).filter(Boolean))].sort());}).catch(()=>{if(!cancelled)setError('Parts of speech could not be loaded. Other search settings remain available.');});return()=>{cancelled=true;};},[]);
 function update(change:Partial<DictionaryOptions>){const next={...options,...change};setOptions(next);try{writeDictionaryOptions(next);setError('');}catch{setError('Could not save dictionary settings.');}}
 const selectClass='w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] px-3 py-3 text-[var(--text-color)]';
 return <main className="app-page dictionary-settings" style={{maxWidth:680,margin:'0 auto',paddingBottom:32}}>
  <div className="page-toolbar"><PageBackLink href="/dictionary/">Back to dictionary</PageBackLink><Link href="/dictionary/" className="ui-text-action">Done</Link></div>
  <PageHeader title="Dictionary settings" icon="settings"/>
  <section className="mt-5 grid gap-5 rounded-3xl border border-[var(--border-color)] bg-[var(--surface-1)] p-5">
   <label className="grid gap-2 text-sm font-semibold">Search in<select aria-label="Search in" value={options.scope} onChange={e=>update({scope:e.target.value})} className={selectClass}><option value="all">All fields</option><option value="coptic">Coptic words</option><option value="english">English meanings</option><option value="transliteration">Transliteration</option></select></label>
   <label className="grid gap-2 text-sm font-semibold">Initial letter<select aria-label="Initial letter" value={options.initial} onChange={e=>update({initial:e.target.value})} className={`coptic-text ${selectClass}`}><option value="">All letters</option>{Array.from(COPTIC_ALPHABET).map(letter=><option key={letter} value={letter}>{letter}</option>)}</select></label>
   <label className="grid gap-2 text-sm font-semibold">Part of speech<select aria-label="Part of speech" value={options.pos} onChange={e=>update({pos:e.target.value})} className={selectClass}><option value="All">All parts of speech</option>{parts.map(pos=><option key={pos} value={pos}>{pos==='q'?'Qualitative':pos}</option>)}</select></label>
   <div className="grid gap-2 border-t border-[var(--border-color)] pt-3">
    <label className="flex min-h-11 items-center justify-between gap-4 text-sm">Search without combining marks<input type="checkbox" className="ui-switch" role="switch" checked={options.ignoreMarks} onChange={e=>update({ignoreMarks:e.target.checked})}/></label>
    <label className="flex min-h-11 items-center justify-between gap-4 text-sm">Spelling suggestions<input type="checkbox" className="ui-switch" role="switch" checked={options.suggestions} onChange={e=>update({suggestions:e.target.checked})}/></label>
    <label className="flex min-h-11 items-center justify-between gap-4 text-sm">Has examples<input type="checkbox" className="ui-switch" role="switch" checked={options.examplesOnly} onChange={e=>update({examplesOnly:e.target.checked})}/></label>
    <label className="flex min-h-11 items-center justify-between gap-4 text-sm">Bohairic-only<input type="checkbox" className="ui-switch" role="switch" aria-disabled={locked} checked={options.bohairicOnly} onClick={e=>{if(locked){e.preventDefault();showLock();}}} onChange={e=>{if(!locked)update({bohairicOnly:e.target.checked});}}/></label>
   </div>
   <button type="button" className="min-h-11 rounded-xl border border-[var(--border-color)] p-3 text-sm" onClick={()=>update({...defaultDictionaryOptions,bohairicOnly:locked})}>Reset search settings</button>
  </section>
  {notice}
  {error&&<p role="alert" className="mt-4">{error}</p>}
 </main>;
}
