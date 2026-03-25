/**
 * iOS-safe body scroll lock.
 * position:fixed hack required for iOS Safari — overflow:hidden alone doesn't work.
 */

let scrollY = 0;
let locked = false;

export function lockScroll() {
  if (locked) return;
  locked = true;
  scrollY = window.scrollY;
  document.body.style.position = 'fixed';
  document.body.style.top = `-${scrollY}px`;
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.overflow = 'hidden';
}

export function unlockScroll() {
  if (!locked) return;
  locked = false;
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.overflow = '';
  window.scrollTo(0, scrollY);
}
