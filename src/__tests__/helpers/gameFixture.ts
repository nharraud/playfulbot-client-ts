import { Game } from "../../grpc/types/playfulbot_runner/v0/Game";
import { GameState } from "../../types";

export const testGameState: GameState = {
  end: false,
  players: [{
    playing: true,
  }]
}

export const gameID = 'game0';
export const playerID = 'player0';

export const testGameInit: Game = {
  id: gameID,
  gameState: JSON.stringify(testGameState),
  player: 0,
  canceled: false,
  version: 0,
}