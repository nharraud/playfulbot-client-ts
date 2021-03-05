import { PlayfulBot } from './playfulbot';
import { GameState } from './tictactoe/types';
import { TicTacToeAI } from './tictactoe/ai';

export async function run_player2() {
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwbGF5ZXJJRCI6InBsYXllcl8xIiwiZ2FtZVNjaGVkdWxlSUQiOiJ1c2VySUQxMSIsImlhdCI6MTYxNDY5OTU5NH0.c_0gvJ3gxReJ3tTS1BbRiHVWBEw-Od8CfV2m3MzcWPw';
  const ai = new TicTacToeAI();
  const bot = new PlayfulBot<GameState>(token, ai);

  await bot.run(false);
}
