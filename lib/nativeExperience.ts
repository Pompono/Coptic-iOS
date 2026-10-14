import {Capacitor,registerPlugin,type PluginListenerHandle} from '@capacitor/core';
export const nativeExperience=registerPlugin<{
 preferences():Promise<{textScale:number}>;
 copy(options:{text:string}):Promise<void>;
 feedback(options:{correct:boolean}):Promise<void>;
 addListener(event:'textScaleChanged',listener:(data:{scale:number})=>void):Promise<PluginListenerHandle>;
}>('AppExperience');
export async function resultFeedback(correct:boolean){
 if(!Capacitor.isNativePlatform())return;
 try{await nativeExperience.feedback({correct});}catch{/* Feedback must never interrupt learning. */}
}

export async function copyText(text:string){
 if(Capacitor.isNativePlatform()){await nativeExperience.copy({text});return;}
 if(!navigator.clipboard?.writeText)throw new Error('Clipboard is unavailable');
 await navigator.clipboard.writeText(text);
}
