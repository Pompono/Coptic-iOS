"use client";
import {setNativeExerciseMode} from "@/lib/nativeExperience";
import {usePathname} from 'next/navigation';
import {useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
export default function AppViewport({children}:{children:ReactNode}){
 const path=usePathname().replace(/\/$/,'');
 const exercise=/^\/learn\/[^/]+\/play\/[^/]+$/.test(path);
 const shell=useRef<HTMLDivElement>(null),[keyboardOpen,setKeyboardOpen]=useState(false);
 useLayoutEffect(()=>{
  document.documentElement.dataset.exerciseRoute=String(exercise);
  if(exercise)window.scrollTo(0,0);
  void setNativeExerciseMode(exercise);
  return()=>{delete document.documentElement.dataset.exerciseRoute;void setNativeExerciseMode(false);};
 },[exercise]);
 useEffect(()=>{
  const viewport=window.visualViewport;
  if(!viewport)return;
  let restingHeight=window.innerHeight,frame=0,settledFrame=0;
  const update=()=>{
   const active=document.activeElement;
   const editing=active instanceof HTMLTextAreaElement||(active instanceof HTMLInputElement&&!['checkbox','radio','button'].includes(active.type));
   if(!editing)restingHeight=window.innerHeight;
   const open=editing&&Math.max(restingHeight,window.innerHeight)-viewport.height>120&&viewport.scale<=1.05;
   shell.current?.style.setProperty('--interactive-viewport-height',`${viewport.height}px`);
   setKeyboardOpen(open);
   cancelAnimationFrame(frame);cancelAnimationFrame(settledFrame);
   // Wait for the keyboard-sized flex layout, then scroll only the lesson pane.
   // scrollIntoView also scrolls WKWebView's outer document and can hide the input.
   if(open)frame=requestAnimationFrame(()=>{settledFrame=requestAnimationFrame(()=>{
    const pane=active?.closest<HTMLElement>('[data-lesson-scroll]');
    if(!pane)return;
    const field=active.getBoundingClientRect(),bounds=pane.getBoundingClientRect();
    if(field.bottom>bounds.bottom-12)pane.scrollTop+=field.bottom-bounds.bottom+12;
    else if(field.top<bounds.top+12)pane.scrollTop-=bounds.top-field.top+12;
   });});
  };
  update();
  viewport.addEventListener('resize',update);viewport.addEventListener('scroll',update);
  document.addEventListener('focusin',update);document.addEventListener('focusout',update);
  return()=>{cancelAnimationFrame(frame);cancelAnimationFrame(settledFrame);viewport.removeEventListener('resize',update);viewport.removeEventListener('scroll',update);document.removeEventListener('focusin',update);document.removeEventListener('focusout',update);};
 },[]);
 return <div ref={shell} className="mobile-chin-page-shell" data-exercise={exercise} data-keyboard={keyboardOpen}>{children}</div>;
}
