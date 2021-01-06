import { PlayfulBot } from './playfulbot';
import { GameState } from './tictactoe/types';
import { TicTacToeAI } from './tictactoe/ai';

async function run_player1() {
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJnYW1lIjoiZGVidWciLCJwbGF5ZXJOdW1iZXIiOjAsImlhdCI6MTYwOTMzNjIwMX0.ETyGuLX6S4g2gnXOYd_69lFpEVdljGRplCR3UVbj46E';
  const ai = new TicTacToeAI();
  const bot = new PlayfulBot<GameState>(token, ai);

  await bot.run();
}

run_player1();
