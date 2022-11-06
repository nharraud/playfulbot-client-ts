import jwt from 'jsonwebtoken';
import * as grpc from '@grpc/grpc-js';

import * as jsonpatch from 'fast-json-patch';

import type { BotAI, GameState } from "./types";
import { createClient } from './grpc/client';
import type { PlayfulBotClient } from './grpc/types/playfulbot/v0/PlayfulBot';
import type { FollowGameResponse } from './grpc/types/playfulbot/v0/FollowGameResponse';
import type { FollowPlayerGamesResponse } from './grpc/types/playfulbot/v0/FollowPlayerGamesResponse';

export class PlayfulBot<GS extends GameState> {
  readonly ai: BotAI<GS>;
  readonly token: string;
  readonly endpoint: string;

  constructor(token: string, botAI: BotAI<GS>, endpoint?: string) {
    this.endpoint = endpoint || 'playfulbot.com:5000';
    this.token = token;
    this.ai = botAI;
  }

  async run() {
    const client = await createClient(this.endpoint);
    const playedGamesPromises = new Set<Promise<void>>();
    
    const authMetadata = new grpc.Metadata();
    authMetadata.set('authorization', this.token);

    return new Promise<void>((resolve, reject) => {
      const playerGamesCall = client.FollowPlayerGames({}, authMetadata);
      playerGamesCall.on('data', (playerGamesResponse: FollowPlayerGamesResponse) => {
        console.log(`Receiving ${playerGamesResponse.games.length} new game(s).`);
        for (const gameID of playerGamesResponse.games) {
          let gamePromise = this.playGame(gameID, client, authMetadata)
          .catch((error) => {
            reject(error);
          })
          .finally(() => playedGamesPromises.delete(gamePromise));
          playedGamesPromises.add(gamePromise);
        }
      });
      playerGamesCall.on('error', (error) => {
        reject(error);
      });
      playerGamesCall.on('close', () => {
        Promise.all(playedGamesPromises)
        .then(() => {
          resolve()
        });
      })
    })
  }

  private async playGame(gameID: string, client: PlayfulBotClient, authMetadata: grpc.Metadata): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const gameCall = client.FollowGame(authMetadata);
      function endCalls() {
        gameCall.end();
        if (playCall) {
          playCall.end();
        }
      }
      gameCall.on('error', (error) => {
        reject(error);
      });
      gameCall.on('end', () => {
        endCalls();
      })
      const playCall = client.PlayGame(authMetadata, (error, result) => {
        if (error) {
          reject(error);
        }
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

      let gameState: GS;
      let player: number;
      gameCall.on('data', (gameResponse: FollowGameResponse) => {
        if ('game' in gameResponse) {
          gameState = JSON.parse(gameResponse.game.gameState);
          player = gameResponse.game.player;
        } else if ('canceled' in gameResponse) {
          endCalls();
          return;
        } else {
          jsonpatch.applyPatch(gameState, JSON.parse(gameResponse.patch.patch) as any, false, true);
        }
        if (gameState.end) {
          endCalls()
        } else {
          if (gameState.players[player].playing) {
            const action = this.ai.run(gameState, player);

            const playMessage = { gameId: gameID, data: JSON.stringify(action) };

            playCall.write(playMessage);
          }
        }
      });

      gameCall.write({ gameId: gameID });
    });
  }
}