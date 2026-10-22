// What each sim event sounds like.
import type { Sound } from '../audio/audio';
import type { SimEvent } from '../sim/types';

export function playEvent(s: Sound, e: SimEvent, mode: 'player' | 'replay') {
  const v = mode === 'replay' ? 0.6 : 1;
  switch (e.t) {
    case 'shot':
      s.play(e.from === 'red' ? 'redShot' : e.item === 'shotgun' ? 'shotgun' : 'shot', v);
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
