import jwt from 'jsonwebtoken';
import * as grpc from '@grpc/grpc-js';

import * as jsonpatch from 'fast-json-patch';

import type { BotAI, GameState } from "./types";
import { createClient } from './grpc/client';
import type { PlayfulBotClient } from './grpc/types/playfulbot/v0/PlayfulBot';
import type { FollowGameResponse } from './grpc/types/playfulbot/v0/FollowGameResponse';
import type { FollowPlayerGamesResponse } from './grpc/types/playfulbot/v0/FollowPlayerGamesResponse';

export class PlayfulBot<GS extends GameState> {
  ai: BotAI<GS>;
  playerID: string;
  endpoint: string;
  token: string;

  constructor(token: string, botAI: BotAI<GS>, endpoint?: string) {
    const { playerID, gameScheduleID } = jwt.decode(token, {json: true});
    this.playerID = playerID;
    this.endpoint = endpoint || 'playfulbot.com:5000';
    this.token = token;

    this.ai = botAI;
  }

  async run() {
    const client = await createClient(this.endpoint);
    
    const authMetadata = new grpc.Metadata();
    authMetadata.set('authorization', this.token);

    const playerGamesCall = client.FollowPlayerGames({ playerId: this.playerID }, authMetadata);
    playerGamesCall.on('data', (playerGamesResponse: FollowPlayerGamesResponse) => {
      // playerGamesResponse.games[0]
      console.log(JSON.stringify(playerGamesResponse));
      for (const gameID of playerGamesResponse.games) {
        this.playGame(gameID, client, authMetadata).catch((error) => {
          console.error('ERROR while playing game');
          console.error(error);
          process.exit(1);
        });
      }


    });
    playerGamesCall.on('error', (error) => {
      console.log('error on PlayerGames');
      // FIXME: end every grpc connection
      process.exit(1);
    });
  }

  async playGame(gameID: string, client: PlayfulBotClient, authMetadata: grpc.Metadata): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const gameCall = client.FollowGame(authMetadata);

      function endCalls() {
        gameCall.end();
        if (playCall) {
          playCall.end();
        }
      }
      gameCall.on('error', (error) => {
        // playerGamesCall.cancel();
        // endCalls();
        console.log('error on gamecall');
        process.exit(1);
      });
      gameCall.on('end', () => {
        endCalls();
      })
      const playCall = client.PlayGame(authMetadata, (error, result) => {
        endCalls();
      });

      let playClosed = false;
      let gameClosed = false;
      const notifyClose = () => {
        if (playClosed && gameClosed) {
          resolve();
        }
      }

      playCall.on('close', () => {
        playClosed = true;
        notifyClose();
      });
      gameCall.on('close', () => {
        gameClosed = true;
        notifyClose();
      });

      let gameState: GS = null;
      let playerNumber: number = null;
      gameCall.on('data', (gameResponse: FollowGameResponse) => {
        if ('game' in gameResponse) {
          gameState = JSON.parse(gameResponse.game.gameState);
          playerNumber = gameResponse.game.players.findIndex((player) => player.id === this.playerID);
        } else if ('canceled' in gameResponse) {
          endCalls();
          return;
        } else {
          jsonpatch.applyPatch(gameState, JSON.parse(gameResponse.patch.patch) as any, false, true);
        }
        if (gameState.end) {
          endCalls()
        } else {
          if (gameState.players[playerNumber].playing) {
            const action = this.ai.run(gameState, playerNumber);

            const playMessage = { gameId: gameID, playerId: this.playerID, action: action.name, data: JSON.stringify(action.data) };

            playCall.write(playMessage);
          }
        }
      });

      gameCall.write({ gameId: gameID });
    });
  }
}