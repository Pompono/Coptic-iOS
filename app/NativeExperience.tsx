"use client";
import {useEffect} from 'react';
import {Capacitor,type PluginListenerHandle} from '@capacitor/core';
import {nativeExperience} from '@/lib/nativeExperience';
/** Follow iOS's preferred text size without changing saved app preferences. */
export default function NativeExperience(){
 useEffect(()=>{
  if(!Capacitor.isNativePlatform())return;
  let disposed=false,listener:PluginListenerHandle|undefined;
  const apply=(scale:number)=>{if(!disposed&&Number.isFinite(scale)&&scale>0){document.documentElement.style.fontSize=`${16*scale}px`;document.documentElement.dataset.largeText=scale>1.4?'true':'false';}};
  void nativeExperience.preferences().then(p=>apply(p.textScale)).catch(()=>{});
  void nativeExperience.addListener('textScaleChanged',data=>apply(data.scale)).then(handle=>{if(disposed)void handle.remove();else listener=handle;}).catch(()=>{});
  return()=>{disposed=true;void listener?.remove();};
 },[]);
 return null;
}
