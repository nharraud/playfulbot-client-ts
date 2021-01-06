import {
  GameState as PBGameState,
  PlayerState as PBPlayerState
} from '../types';

export interface GameState extends PBGameState {
  grid: string[];
  players: PlayerState[];
}

export interface PlayerState extends PBPlayerState {
  symbol: string
}
