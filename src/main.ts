import { createGame } from './game/game';
import { mountApp } from './ui/app';
import './style.css';

const PLAYER_ID = 'you';

const state = createGame(Date.now(), [
  { id: PLAYER_ID, name: 'You', isBot: false },
  ...Array.from({ length: 7 }, (_, i) => ({ id: `bot${i + 1}`, name: `Bot ${i + 1}`, isBot: true })),
]);

mountApp(document.querySelector<HTMLElement>('#app')!, state, PLAYER_ID);
