import { createGame } from './game/game';
import { mountApp } from './ui/app';
import { showHome } from './ui/home';
import './style.css';

const PLAYER_ID = 'you';

const root = document.querySelector<HTMLElement>('#app')!;
const botLevel = await showHome(root);

const state = createGame(Date.now(), [
  { id: PLAYER_ID, name: 'You', isBot: false },
  ...Array.from({ length: 7 }, (_, i) => ({ id: `bot${i + 1}`, name: `Bot ${i + 1}`, isBot: true, botLevel })),
]);

await mountApp(root, state, PLAYER_ID);
