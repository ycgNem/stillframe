// How a KeyboardEvent.code is written on a keycap.
const NAMES: Record<string, string> = {
  Space: 'Space', Enter: 'Enter', Escape: 'Esc', Tab: 'Tab', Backspace: 'Bksp', ShiftLeft: 'Shift', ShiftRight: 'Shift',
  ControlLeft: 'Ctrl', ControlRight: 'Ctrl', AltLeft: 'Alt', AltRight: 'Alt', ArrowUp: 'Up', ArrowDown: 'Down',
  ArrowLeft: 'Left', ArrowRight: 'Right', CapsLock: 'Caps', Backquote: '`', Minus: '-', Equal: '=', Comma: ',',
  Period: '.', Slash: '/', Semicolon: ';', Quote: "'", BracketLeft: '(', BracketRight: ')', Backslash: '/',
};

export function keyLabel(code: string): string {
  if (NAMES[code]) return NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `N${code.slice(6)}`;
  return code.slice(0, 5);
}
