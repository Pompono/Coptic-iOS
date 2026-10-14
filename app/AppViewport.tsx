"use client";
import {usePathname} from 'next/navigation';
import {useEffect,useRef,useState,type ReactNode} from 'react';
export default function AppViewport({children}:{children:ReactNode}){
 const path=usePathname().replace(/\/$/,'');
 const exercise=/^\/learn\/[^/]+\/play\/[^/]+$/.test(path);
 const shell=useRef<HTMLDivElement>(null),[keyboardOpen,setKeyboardOpen]=useState(false);
 useEffect(()=>{
  const viewport=window.visualViewport;
  if(!viewport)return;
  let restingHeight=window.innerHeight,frame=0;
  const update=()=>{
   const active=document.activeElement;
   const editing=active instanceof HTMLTextAreaElement||(active instanceof HTMLInputElement&&!['checkbox','radio','button'].includes(active.type));
   if(!editing)restingHeight=window.innerHeight;
   const open=editing&&Math.max(restingHeight,window.innerHeight)-viewport.height>120&&viewport.scale<=1.05;
   shell.current?.style.setProperty('--interactive-viewport-height',`${viewport.height}px`);
   setKeyboardOpen(open);
   cancelAnimationFrame(frame);
   if(open)frame=requestAnimationFrame(()=>active?.scrollIntoView({block:'nearest',behavior:'instant'}));
  };
  viewport.addEventListener('resize',update);document.addEventListener('focusin',update);document.addEventListener('focusout',update);
  return()=>{cancelAnimationFrame(frame);viewport.removeEventListener('resize',update);document.removeEventListener('focusin',update);document.removeEventListener('focusout',update);};
 },[]);
 return <div ref={shell} className="mobile-chin-page-shell" data-exercise={exercise} data-keyboard={keyboardOpen}>{children}</div>;
}
