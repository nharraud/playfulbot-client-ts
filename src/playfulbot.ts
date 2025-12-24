import * as grpc from '@grpc/grpc-js';

import * as jsonpatch from 'fast-json-patch';

import type { BotAI, GameState } from "./types";
import { createBackendClient, createRunnerClient } from './grpc/client';
import type { PlayfulBotClient } from './grpc/types/playfulbot_backend/v0/PlayfulBot';
import type { FollowGameResponse } from './grpc/types/playfulbot_runner/v0/FollowGameResponse';
import type { FollowPlayerGamesResponse } from './grpc/types/playfulbot_backend/v0/FollowPlayerGamesResponse';
import { GameRef } from './grpc/types/playfulbot_backend/v0/GameRef';

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
    const backendClient = await createBackendClient(this.endpoint);
    const playedGamesPromises = new Set<Promise<void>>();
    
    const authMetadata = new grpc.Metadata();
    authMetadata.set('authorization', this.token);

    return new Promise<void>((resolve, reject) => {
      const playerGamesCall = backendClient.FollowPlayerGames({}, authMetadata);
      playerGamesCall.on('data', (playerGamesResponse: FollowPlayerGamesResponse) => {
        console.log(`Receiving ${playerGamesResponse.games.length} new game(s).`);
        for (const gameRef of playerGamesResponse.games) {
          let gamePromise = this.playGame(gameRef, backendClient, authMetadata)
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

  private async playGame(gameRef: GameRef, client: PlayfulBotClient, authMetadata: grpc.Metadata): Promise<void> {
    const runnerClient = await createRunnerClient(gameRef.url);
    return new Promise<void>((resolve, reject) => {
      const gameCall = runnerClient.FollowGame(authMetadata);
      function endCalls() {
        gameCall.end();
        if (playCall) {
          playCall.end();
        }
        runnerClient.close();
      }
      gameCall.on('error', (error) => {
        reject(error);
      });
      gameCall.on('end', () => {
        endCalls();
      })
      const playCall = runnerClient.PlayGame(authMetadata, (error, result) => {
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

            const playMessage = { gameId: gameRef.id, data: JSON.stringify(action) };

            playCall.write(playMessage);
          }
        }
      });

      gameCall.write({ gameId: gameRef.id });
    });
  }
}