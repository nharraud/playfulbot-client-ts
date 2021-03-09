import { execute, gql, toPromise } from "@apollo/client/core";
import { WebSocketLink } from "@apollo/client/link/ws";
import { GameState, LiveGame, isGame, Game } from "src/types";
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
    
    // const GAME_PATCH_SUBSCRIPTION = {
    //   query: gql`
    //     subscription onGameChanges($gameID: ID!) {
    //       gamePatch(gameID: $gameID) {
    //         patch, version
    //       }
    //     }
    //   `,
    //   variables: {gameID: this.gameID},
    // };

    const GAME_PATCH_SUBSCRIPTION = {
      query: gql`
        subscription onGameChanges($gameID: ID!) {
          gamePatch(gameID: $gameID) {
            ... on GamePatch {
              patch, version
            }

            ... on Game {
              id
              assignments {
                playerID, playerNumber
              }
              version
              gameState
            }
          }
        }
      `,
      variables: {gameID: this.gameID},
    };

    const patches = observableToAsyncGenerator<any>(execute(this.link, GAME_PATCH_SUBSCRIPTION))

    // let gameResponse = await toPromise(execute(this.link, GAME_QUERY));

    // if (!gameResponse?.data?.game.id) {
    //   throw new Error("Game could not be retrieved");
    // }
    // let game = gameResponse.data.game;
    let game: Game<GS> = null;

    // if (game.gameState.players[this.playerNumber].playing) {
    //   yield game.gameState;
    // }

    let patch: {data: { gamePatch: LiveGame<GS> } };
    for await (patch of patches) {
      if (game === null && isGame(patch.data.gamePatch)) {
        game = patch.data.gamePatch;
      }
      else if (patch.data.gamePatch.version < game.version + 1) {
        console.log(`${this.playerNumber} - OLD VERSION RECEIVED ${patch.data.gamePatch.version}`);
        continue;
      } else if (patch.data.gamePatch.version > game.version + 1) {
        console.log('Game state does not match last received patch. Fetching game again.')
        console.log(`${this.playerNumber} - === OLD STATE ===`)
        console.log(JSON.stringify(game, null, 2))
        console.log('=== PATCH ===')
        console.log(JSON.stringify(patch.data, null, 2))
        let gameResponse = await toPromise(execute(this.link, GAME_QUERY));
        game = gameResponse.data.game;
        console.log('=== NEW STATE ===')
        console.log(JSON.stringify(game, null, 2))
        const val = (await patches.next()).value;
        console.log('=== NEXT PATCH ===')
        console.log(JSON.stringify(val, null, 2))
      } else {
        if (isGame(patch.data.gamePatch)) {
          game = patch.data.gamePatch;
        } else {
          jsonpatch.applyPatch(game.gameState, patch.data.gamePatch.patch as any, false, true);
          game.version = patch.data.gamePatch.version
        }
      }
      // console.log(`${this.playerNumber} - VERSION: ${game.version} -  END: ${game.gameState.end}`);
      if (game.gameState.end) {
        break;
      }
      if (game.gameState.players[this.playerNumber].playing) {
        // console.log(`${this.playerNumber} - VERSION: ${game.version} - YIELD to player`);
        yield game.gameState
        // console.log(`${this.playerNumber} - VERSION: ${game.version} - YIELDED to player`);
      }
    }
  }
}