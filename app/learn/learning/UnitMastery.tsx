"use client";
import { useEffect, useState } from 'react';
import { LEARNING_KEY, parseLearning, masteryState } from '@/lib/learning/progress.mjs';
export default function UnitMastery({ unitId }: { unitId:string }) {
  const [counts,setCounts] = useState<Record<string,number>>({});
  useEffect(()=>{
    const update=()=>{
      try {
        const skills=Object.values(parseLearning(localStorage.getItem(LEARNING_KEY)).skills).filter((skill:any)=>(skill.unitIds ?? [skill.unitId]).includes(unitId));
        const result={}; for(const skill of skills){ const state=masteryState(skill);result[state]=(result[state]??0)+1; } setCounts(result);
      } catch { setCounts({}); }
    };
    update(); window.addEventListener('coptic-learning-change',update);window.addEventListener('storage',update);
    return()=>{window.removeEventListener('coptic-learning-change',update);window.removeEventListener('storage',update);};
  },[unitId]);
  if(!Object.keys(counts).length)return null;
  return <p aria-label="Skill mastery" style={{fontSize:13,lineHeight:1.4,margin:'10px 0 0',color:'inherit'}}>Recall: {['Needs practice','Building','Secure'].filter(state=>counts[state]).map(state=>`${counts[state]} ${state.toLowerCase()}`).join(' · ')}</p>;
}
