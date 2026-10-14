import {Capacitor,registerPlugin,type PluginListenerHandle} from '@capacitor/core';
export const nativeExperience=registerPlugin<{
 preferences():Promise<{textScale:number}>;
 feedback(options:{correct:boolean}):Promise<void>;
 addListener(event:'textScaleChanged',listener:(data:{scale:number})=>void):Promise<PluginListenerHandle>;
}>('AppExperience');
export async function resultFeedback(correct:boolean){
 if(!Capacitor.isNativePlatform())return;
 try{await nativeExperience.feedback({correct});}catch{/* Feedback must never interrupt learning. */}
}
