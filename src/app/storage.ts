// The save in localStorage (key stillframe.save.v1). Storage can be missing or full (private windows,
// blocked site data), so every read and write is guarded; the game still plays without it.
import { migrate, newSave, type Save } from '../meta/save';

const KEY = 'stillframe.save.v1';

export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? migrate(JSON.parse(raw)) : newSave();
  } catch {
    return newSave();
  }
}

export function writeSave(s: Save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // nothing to do: this session just won't be remembered
  }
}
