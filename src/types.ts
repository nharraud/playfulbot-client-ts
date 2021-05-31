
export type GameID = string;

export interface GameState {
  end: boolean;
  players: PlayerState[];
}

export interface PlayerState {
  points: number,
  playing: boolean
}

export interface GameAction {
  name: string,
  data: any
}

export interface BotAI<GS extends GameState> {
  run(gameState: GS, playerNumber: number): GameAction;
}
