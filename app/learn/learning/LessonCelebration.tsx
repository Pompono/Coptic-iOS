import {useEffect, useState} from 'react';
import AppIcon from '@/app/AppIcon';
import styles from './learning.module.css';

export default function LessonCelebration({ playing, duration, error, onComplete }: { playing:boolean; duration:number; error:string; onComplete:()=>void }) {
  const [leaving,setLeaving] = useState(false);
  useEffect(()=>{
    if(!playing)return;
    const fade = window.setTimeout(()=>setLeaving(true),duration);
    const finish = window.setTimeout(onComplete,duration+400);
    return()=>{window.clearTimeout(fade);window.clearTimeout(finish);};
  },[playing,duration,onComplete]);
  return <main className={`lesson-outcome-screen ${styles.celebrationScreen}`} data-celebrating={playing} data-leaving={leaving}>
    <div className={styles.celebrationBody}>
      <div className={styles.celebrationArt} aria-hidden="true">
        <div className={styles.celebrationHalo}/>
        <svg className={styles.celebrationSeal} viewBox="0 0 240 240" fill="none">
          <circle className={styles.sealRing} cx="120" cy="120" r="101" pathLength="1"/>
        </svg>
        <div className={styles.celebrationCross}><AppIcon name="cross" size={80}/></div>
      </div>
      <div className={styles.celebrationMessage} role="status"><h1>Lesson complete</h1></div>
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </div>
  </main>;
}
