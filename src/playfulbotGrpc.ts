import jwt from 'jsonwebtoken';
import * as grpc from '@grpc/grpc-js';

import * as jsonpatch from 'fast-json-patch';

import { asyncStream } from './utils/async';
import { BotAI, GameState } from "./types";
import { createClient } from './grpc/client';
import { ClientInterfaces } from './grpc/proto/types/playfulbot_v0';
import { FollowGameRequest } from './grpc/proto/types/playfulbot/v0/FollowGameRequest';
import { FollowGameResponse, FollowGameResponse__Output } from './grpc/proto/types/playfulbot/v0/FollowGameResponse';
import { PlayGameRequest } from './grpc/proto/types/playfulbot/v0/PlayGameRequest';
import { PlayGameResponse__Output } from './grpc/proto/types/playfulbot/v0/PlayGameResponse';
import { FollowPlayerGamesResponse } from './grpc/proto/types/playfulbot/v0/FollowPlayerGamesResponse';

export class PlayfulBotGrpc<GS extends GameState> {
  ai: BotAI<GS>;
  playerID: string;
  clientCache?: ClientInterfaces.playfulbot.v0.PlayfulBotClient;
  endpoint: string;
  token: string;

  constructor(endpoint: string, token: string, botAI: BotAI<GS>, graphqlEndpoint: string) {
    const { playerID, gameScheduleID } = jwt.decode(token, {json: true});
    this.playerID = playerID;
    this.endpoint = endpoint;
    this.token = token;

    this.ai = botAI;
  }

  async getClient(): Promise<ClientInterfaces.playfulbot.v0.PlayfulBotClient> {
    if (!this.clientCache) {
      this.clientCache = await createClient(this.endpoint);
    }
    return this.clientCache;
  }

  async run() {
    const {push, reject, complete, out} = asyncStream<void>();
    const client = await this.getClient();

    const metadata = new grpc.Metadata();
    metadata.set('authorization', this.token);

    async function getGameClient(endpoint: string) {
      return Promise.resolve(client);
      // return createClient(endpoint);
    }
    const playerGamesCall = client.FollowPlayerGames({ playerId: this.playerID }, metadata);
    playerGamesCall.on('data', (playerGamesResponse: FollowPlayerGamesResponse) => {
      let playClosed = false;
      let gameClosed = false;
      getGameClient(this.endpoint).then((gameClient) => {

        function endCalls() {
          gameCall.end();
          if (playCall) {
            playCall.end();
          }
        }

        const gameCall = gameClient.FollowGame(metadata);

        gameCall.on('error', (error) => {
          playerGamesCall.cancel();
          endCalls();
          console.log('error on gamecall')
          reject(error);
        });
        gameCall.on('end', () => {
          endCalls();
        })
        const playCall = gameClient.PlayGame(metadata, (error, result) => {
          endCalls();
          if (error) {
            reject(error);
          }
        });


        const notifyClose = () => {
          if (playClosed && gameClosed) {
            push();
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
          } else {
            jsonpatch.applyPatch(gameState, JSON.parse(gameResponse.patch.patch) as any, false, true);
          }
          if (gameState.end) {
            endCalls()
          } else {
            if (gameState.players[playerNumber].playing) {
              const action = this.ai.run(gameState, playerNumber);

              const playMessage = { gameId: playerGamesResponse.games[0], playerId: this.playerID, action: action.name, data: JSON.stringify(action.data) };

              playCall.write(playMessage);
            }
          }
        });

        // FIXME: handle more games than the first one
        gameCall.write({ gameId: playerGamesResponse.games[0] });
      });
    });
    playerGamesCall.on('error', (error) => {
      console.log('error on scheduleCall');
      // FIXME: end every grpc connection
      reject(error);
    });
    return out();
  }
}