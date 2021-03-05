
export type GameID = string;
export type PlayerID = string;

export interface GameState {
  end: boolean;
  players: PlayerState[];
}

export interface PlayerAssignment {
  playerID: PlayerID;
  playerNumber: number;
}


export interface Game<GS extends GameState> {
  id: GameID;
  version: number;
  assignments: PlayerAssignment[];
  gameState: GS;
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
  run(gameState: GS): GameAction;
}