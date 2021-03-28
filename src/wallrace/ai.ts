import { Coordinate, WallRaceGameState } from './types';
import { BotAI, GameAction } from '../types'

function collidesWithWalls(coordinate: Coordinate, walls: Coordinate[][], arenaSize: number) {
  if (
    coordinate[0] < 0 ||
    coordinate[1] < 0 ||
    coordinate[0] >= arenaSize ||
    coordinate[1] >= arenaSize
  ) {
    return true;
  }
  for (const wall of walls) {
    let sectionStart: Coordinate = null;
    for (const sectionEnd of wall) {
      if (sectionStart === null) {
        sectionStart = sectionEnd;
        continue;
      }
      const max = [
        Math.max(sectionStart[0], sectionEnd[0]),
        Math.max(sectionStart[1], sectionEnd[1]),
      ];
      const min = [
        Math.min(sectionStart[0], sectionEnd[0]),
        Math.min(sectionStart[1], sectionEnd[1]),
      ];
      if (
        coordinate[0] >= min[0] &&
        coordinate[0] <= max[0] &&
        coordinate[1] >= min[1] &&
        coordinate[1] <= max[1]
      ) {
        return true;
      }
      sectionStart = sectionEnd;
    }
  }
  return false;
}

export class WallRaceAI implements BotAI<WallRaceGameState> {

  run(gameState: WallRaceGameState, playerNumber: number): GameAction {

    const path = gameState.walls[playerNumber];
    const position = path[path.length - 1];
    const up: Coordinate = [position[0], position[1] + 1];
    const down: Coordinate = [position[0], position[1] - 1];
    const left: Coordinate = [position[0] - 1, position[1]];
    const right: Coordinate = [position[0] + 1, position[1]];

    let vector: Coordinate = null;
    if (!collidesWithWalls(up, gameState.walls, gameState.arena.size)) {
      vector = [0, 1];
    } else if (!collidesWithWalls(down, gameState.walls, gameState.arena.size)) {
      vector = [0, -1];
    } else if (!collidesWithWalls(left, gameState.walls, gameState.arena.size)) {
      vector = [-1, 0];
    } else {
      vector = [1, 0];
    }
    
    return { name: "move", data: { vector } }
  }
}