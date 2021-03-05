import { PlayfulBot } from './playfulbot';
import { GameState } from './tictactoe/types';
import { TicTacToeAI } from './tictactoe/ai';

export async function run_player1() {
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwbGF5ZXJJRCI6InBsYXllcl8wIiwiZ2FtZVNjaGVkdWxlSUQiOiJ1c2VySUQxMSIsImlhdCI6MTYxNDY5OTU5NH0.3pus4vbBdZYR9kgvK8uOIHcCRRBddRQF1Ri9DHemCOE';
  const ai = new TicTacToeAI();
  const bot = new PlayfulBot<GameState>(token, ai);

  await bot.run(true);
}
