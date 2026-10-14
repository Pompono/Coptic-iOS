"use client";
import {useCallback,useEffect,useRef,useState} from 'react';

export default function useSettingsLockNotice() {
  const [visible,setVisible]=useState(false),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const show=useCallback(()=>{clearTimeout(timer.current);setVisible(true);timer.current=setTimeout(()=>setVisible(false),2000);},[]);
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  return {show,notice:<div className={`settings-lock-notice ${visible?'is-visible':''}`} role="status" aria-live="polite">{visible?'This is locked by Settings.':''}</div>};
}
