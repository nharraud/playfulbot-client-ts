
export type GameID = string;

export interface GameState {
  end: boolean;
  players: PlayerState[];
}

export interface PlayerState {
  winner?: boolean,
  playing: boolean,
}

export interface BotAI<GS extends GameState> {
  run(gameState: GS, playerNumber: number): unknown;
}
