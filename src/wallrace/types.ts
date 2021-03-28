import {
  GameState as PBGameState
} from '../types';


export type Coordinate = [number, number];

export interface WallRaceGameState extends PBGameState {
  arena: { size: number };
  walls: Coordinate[][];
}
