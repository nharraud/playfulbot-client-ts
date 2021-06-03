import { BotAI, GameState } from "../../types";

export const noopActionName = 'noop';
export const noopData = { noop: 'testValue' };

export class NoopAI implements BotAI<GameState> {
  run(gameState: GameState, playerNumber: number) {
    return {
      name: noopActionName,
      data: noopData,
    }
  }
}


