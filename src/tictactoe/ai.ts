import { GameState } from './types';
import { BotAI, GameAction } from '../types'

function preventAdversaryLine() {
  
}

function chooseSpaceToFill(game: GameState) {
  
}

export class TicTacToeAI implements BotAI<GameState> {

  run(gameState: GameState): GameAction {
    for (const [idx, value] of gameState.grid.entries()) {
      if (!value) {
        return { name: "fillSpace", data: { space: idx } }
      }
    }
  }
}