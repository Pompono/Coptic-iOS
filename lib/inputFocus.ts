import type {PointerEvent} from 'react';

/** Let click commit before iOS dismisses the keyboard and moves the action. */
export function keepInputFocusOnPress(event:PointerEvent<HTMLButtonElement>){
  const active=document.activeElement;
  if(event.isPrimary&&event.button===0&&(active instanceof HTMLInputElement||active instanceof HTMLTextAreaElement))event.preventDefault();
}
