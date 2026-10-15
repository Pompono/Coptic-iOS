import type { CSSProperties } from 'react';
import AppIcon from '@/app/AppIcon';
import styles from './learning.module.css';

export default function LessonCelebration({ playing, error, onContinue }: { playing:boolean; error:string; onContinue:()=>void }) {
  return <main className={`lesson-outcome-screen ${styles.celebrationScreen}`} data-celebrating={playing}>
    <div className={styles.celebrationBody}>
      <div className={styles.celebrationArt} aria-hidden="true">
        <div className={styles.celebrationHalo}/>
        <svg className={styles.celebrationSeal} viewBox="0 0 240 240" fill="none">
          <circle className={styles.sealTrack} cx="120" cy="120" r="101"/>
          <circle className={styles.sealRing} cx="120" cy="120" r="101" pathLength="1"/>
          <circle className={styles.sealInner} cx="120" cy="120" r="89"/>
          {[0,90,180,270].map(angle=><path key={angle} transform={`rotate(${angle} 120 120)`} d="m120 7 4 6-4 6-4-6Z" fill="currentColor"/>) }
        </svg>
        <div className={styles.celebrationCross}><AppIcon name="cross" size={80}/></div>
        {Array.from({length:12},(_,index)=><span key={index} className={styles.celebrationSpark} style={{'--angle':`${index*30+15}deg`,'--delay':`${index%3*70}ms`} as CSSProperties}><i/></span>)}
      </div>
      <div className={styles.celebrationMessage} role="status"><p>Well done</p><h1>Lesson complete</h1></div>
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </div>
    <footer className={styles.introFooter}><button className={styles.primary} onClick={onContinue}>Continue</button></footer>
  </main>;
}
