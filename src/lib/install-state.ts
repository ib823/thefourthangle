/**
 * Install prompt state — shared reactive store.
 * Detects PWA installability and manages dismissal cooldown.
 */

let _deferredPrompt: any = null;
let _canInstall = false;
let _isIOS = false;
let _isInstalled = false;
let _dismissed = false;
let _listeners: Array<() => void> = [];
let _initialized = false;

const DISMISS_KEY = 'tfa-install-dismissed';
const DISMISS_COOLDOWN = 30 * 24 * 60 * 60 * 1000; // 30 days

function notify() {
  for (const fn of _listeners) fn();
}

export function initInstallState(): void {
  if (_initialized || typeof window === 'undefined') return;
  _initialized = true;

  if (window.matchMedia('(display-mode: standalone)').matches) {
    _isInstalled = true;
    return;
  }

  const ua = navigator.userAgent;
  _isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const dismissedAt = localStorage.getItem(DISMISS_KEY);
  _dismissed = !!dismissedAt && Date.now() - parseInt(dismissedAt) < DISMISS_COOLDOWN;

  if (_isIOS) {
    _canInstall = !_dismissed;
    notify();
    return;
  }

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    _deferredPrompt = e;
    _canInstall = !_dismissed;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    _isInstalled = true;
    _canInstall = false;
    _deferredPrompt = null;
    notify();
  });
}

export function canInstall(): boolean {
  return _canInstall && !_isInstalled && !_dismissed;
}

export function isIOS(): boolean {
  return _isIOS;
}

export function isInstalled(): boolean {
  return _isInstalled;
}

export async function triggerInstall(): Promise<void> {
  if (_isIOS) return; // iOS handled by UI guide
  if (!_deferredPrompt) return;
  _deferredPrompt.prompt();
  const { outcome } = await _deferredPrompt.userChoice;
  if (outcome === 'accepted') {
    _canInstall = false;
  }
  _deferredPrompt = null;
  notify();
}

export function dismissInstall(): void {
  _canInstall = false;
  _dismissed = true;
  localStorage.setItem(DISMISS_KEY, String(Date.now()));
  notify();
}

export function onInstallChange(fn: () => void): () => void {
  _listeners.push(fn);
  return () => {
    _listeners = _listeners.filter(l => l !== fn);
  };
}
