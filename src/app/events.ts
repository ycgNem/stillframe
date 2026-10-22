// What each sim event sounds like.
import type { Sound } from '../audio/audio';
import type { SimEvent } from '../sim/types';

export function playEvent(s: Sound, e: SimEvent, mode: 'player' | 'replay') {
  const v = mode === 'replay' ? 0.6 : 1;
  switch (e.t) {
    case 'shot':
      if (e.from === 'red') s.play(e.item === 'rifle' ? 'rifle' : 'redShot', v);
      else s.play(e.item === 'shotgun' ? 'shotgun' : e.item === 'smg' ? 'smg' : e.item === 'rifle' ? 'rifle' : 'shot', v);
      break;
    case 'slash':
      s.play('slash', v);
      break;
    case 'reflect':
      s.play('reflect', v);
      break;
    case 'split':
      s.play('split', v);
      break;
    case 'fall':
      s.play('fall', v);
      break;
    case 'warn':
      if (mode === 'player') s.play('warn', 0.9);
      break;
    case 'train':
      s.play('train', v);
      break;
    case 'land':
      s.play('land', v);
      break;
    case 'beat':
      s.play('beat', v * (e.n === 0 ? 1 : 0.5));
      break;
    case 'drop':
      s.play('drop', v);
      break;
    case 'punch':
      s.play(e.hit ? 'punch' : 'whiff', v);
      break;
    case 'throw':
      s.play('throw', v);
      break;
    case 'pickup':
      if (e.who === 'player') s.play('pickup', v);
      break;
    case 'shatter':
      s.play('shatter', v);
      break;
    case 'glass':
      s.play('glass', v * 0.8);
      break;
    case 'parry':
      s.play('parry', v);
      break;
    case 'tell':
      if (mode === 'player') s.play('tell', 0.8);
      break;
    case 'death':
      s.play('death', v);
      break;
    case 'clear':
      s.play('clear', v);
      break;
    case 'shield':
      s.play('shield', v);
      break;
    case 'dash':
      s.play('dash', v);
      break;
    case 'spawn':
      s.play('door', v * 0.7);
      break;
    case 'wave':
      if (e.n > 1) s.play('wave', v);
      break;
    case 'deflect':
      s.play('deflect', v);
      break;
    case 'break':
      s.play('break', v);
      break;
    case 'phase':
      s.play('phase', v);
      break;
    case 'stun':
      s.play('stun', v);
      break;
    case 'disarm':
      s.play('pickup', v * 0.5);
      break;
  }
}
