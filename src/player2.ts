import { PlayfulBot } from './playfulbot';
import { GameState } from './tictactoe/types';
import { TicTacToeAI } from './tictactoe/ai';

async function run_player2() {
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoiMSIsImdhbWUiOiJkZWJ1ZyIsInBsYXllck51bWJlciI6MSwiaWF0IjoxNjA5ODg4NDcwfQ.ygtTOMk78vabMpv3s62afRbtpPaz0pEVGwKfLCaSdWc';
  const ai = new TicTacToeAI();
  const bot = new PlayfulBot<GameState>(token, ai);

  await bot.run();
}

run_player2();
