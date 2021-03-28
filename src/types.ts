
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


export interface GamePatch {
  gameID: GameID;
  version: number;
  patch: JSON;
}

export type LiveGame<GS extends GameState> = Game<GS> | GamePatch;

export function isGamePatch<GS extends GameState>(liveGame: LiveGame<GS>): liveGame is GamePatch {
  return (liveGame as GamePatch).patch !== undefined;
}

export function isGame<GS extends GameState>(liveGame: LiveGame<GS>): liveGame is Game<GS> {
  return (liveGame as Game<GS>).gameState !== undefined;
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
