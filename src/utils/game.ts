import { execute, gql, toPromise } from "@apollo/client/core";
import { WebSocketLink } from "@apollo/client/link/ws";
import { GameState } from "src/types";
import { observableToAsyncGenerator } from "./async";
import * as jsonpatch from 'fast-json-patch';

export class PlayedGame<GS extends GameState> {
  playerNumber: number;
  gameID: string;
  link: WebSocketLink;

  constructor(gameID: string, playerNumber: number, link: WebSocketLink) {
    this.link = link;
    this.gameID = gameID;
    this.playerNumber = playerNumber;
  }

  async *gameStates(): AsyncGenerator<GS, void, unknown> {
    const GAME_QUERY = {
      query: gql`
        query GetGame($gameID: ID!) {
          game(gameID: $gameID) {
            id
            assignments {
              playerID, playerNumber
            }
            version
            gameState
            }
        }
      `,
      variables: {gameID: this.gameID},
    };
    
    const GAME_PATCH_SUBSCRIPTION = {
      query: gql`
        subscription onGameChanges($gameID: ID!) {
          gamePatch(gameID: $gameID) {
            patch, version
          }
        }
      `,
      variables: {gameID: this.gameID},
    };

    const patches: any = observableToAsyncGenerator(execute(this.link, GAME_PATCH_SUBSCRIPTION))

    let gameResponse = await toPromise(execute(this.link, GAME_QUERY));

    if (!gameResponse?.data?.game.id) {
      throw new Error("Game could not be retrieved");
    }
    let game = gameResponse.data.game;

    if (game.gameState.players[this.playerNumber].playing) {
      yield game.gameState;
    }

    for await (const patch of patches) {
      if (patch.data.gamePatch.version < game.version + 1) {
        continue;
      } else if (patch.data.gamePatch.version > game.version + 1) {
        console.log('Game state does not match last received patch. Fetching game again.')
        gameResponse = await toPromise(execute(this.link, GAME_QUERY));
        game = gameResponse.data.game;
      } else {
        jsonpatch.applyPatch(game.gameState, patch.data.gamePatch.patch, false, true);
        game.version = patch.data.gamePatch.version
      }
      if (game.gameState.end) {
        break;
      }
      if (game.gameState.players[this.playerNumber].playing) {
        yield game.gameState;
      }
    }
  }
}