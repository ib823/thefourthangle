import { persistentAtom } from '@nanostores/persistent';
import { atom } from 'nanostores';

export const $savedCards = persistentAtom<Array<{issueSlug: string, cardIndex: number}>>('fa-saved', [], {
  encode: JSON.stringify,
  decode: JSON.parse,
});

export const $readHistory = persistentAtom<string[]>('fa-read', [], {
  encode: JSON.stringify,
  decode: JSON.parse,
});

export const $currentView = atom<'feed' | 'saved' | 'about'>('feed');
