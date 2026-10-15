import type {MouseEvent,PointerEvent,TouchEvent} from 'react';

/** Let click commit before iOS dismisses the keyboard and moves the action. */
export function keepInputFocusOnPress(event:PointerEvent<HTMLButtonElement>){
  const active=document.activeElement;
  if(event.isPrimary&&event.button===0&&(active instanceof HTMLInputElement||active instanceof HTMLTextAreaElement))event.preventDefault();
}

const touches=new WeakMap<HTMLButtonElement,{x:number;y:number}>();
export const lessonActionPressHandlers={
  onPointerDown:keepInputFocusOnPress,
  onMouseDown(event:MouseEvent<HTMLButtonElement>){
    const active=document.activeElement;
    if(event.button===0&&(active instanceof HTMLInputElement||active instanceof HTMLTextAreaElement))event.preventDefault();
  },
  onTouchStart(event:TouchEvent<HTMLButtonElement>){
    touches.delete(event.currentTarget);
    const active=document.activeElement,touch=event.touches[0];
    if(event.touches.length===1&&touch&&(active instanceof HTMLInputElement||active instanceof HTMLTextAreaElement))touches.set(event.currentTarget,{x:touch.clientX,y:touch.clientY});
  },
  onTouchMove(event:TouchEvent<HTMLButtonElement>){
    const start=touches.get(event.currentTarget),touch=event.touches[0];
    if(start&&(!touch||Math.hypot(touch.clientX-start.x,touch.clientY-start.y)>10))touches.delete(event.currentTarget);
  },
  onTouchCancel(event:TouchEvent<HTMLButtonElement>){touches.delete(event.currentTarget);},
  onTouchEnd(event:TouchEvent<HTMLButtonElement>){
    const button=event.currentTarget,start=touches.get(button),touch=event.changedTouches[0];
    touches.delete(button);
    if(!start||!touch)return;
    const box=button.getBoundingClientRect();
    if(touch.clientX<box.left||touch.clientX>box.right||touch.clientY<box.top||touch.clientY>box.bottom)return;
    // Safari may dismiss the keyboard before its delayed compatibility click.
    // Commit once while the button is still in place, cancelling that click.
    event.preventDefault();
    button.click();
  },
};
