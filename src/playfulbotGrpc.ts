import jwt from 'jsonwebtoken';
import * as grpc from '@grpc/grpc-js';

import * as jsonpatch from 'fast-json-patch';

import { asyncStream } from './utils/async';
import { BotAI, GameState } from "./types";
import { createClient } from './grpc/client';
import { ClientInterfaces } from './grpc/proto/types/playfulbot_v0';
import { FollowGameRequest } from './grpc/proto/types/playfulbot/v0/FollowGameRequest';
import { FollowGameResponse, FollowGameResponse__Output } from './grpc/proto/types/playfulbot/v0/FollowGameResponse';
import { FollowGameScheduleResponse } from './grpc/proto/types/playfulbot/v0/FollowGameScheduleResponse';
import { PlayerAssignment } from './grpc/proto/types/playfulbot/v0/PlayerAssignment';
import { PlayGameRequest } from './grpc/proto/types/playfulbot/v0/PlayGameRequest';
import { PlayGameResponse__Output } from './grpc/proto/types/playfulbot/v0/PlayGameResponse';

export class PlayfulBotGrpc<GS extends GameState> {
  ai: BotAI<GS>;
  playerID: string;
  gameScheduleID: string;
  clientCache?: ClientInterfaces.playfulbot.v0.PlayfulBotClient;

  constructor(token: string, botAI: BotAI<GS>, graphqlEndpoint: string) {
    const { playerID, gameScheduleID } = jwt.decode(token, {json: true});
    this.playerID = playerID;
    this.gameScheduleID = gameScheduleID;

    this.ai = botAI;
  }

  async getClient(): Promise<ClientInterfaces.playfulbot.v0.PlayfulBotClient> {
    if (!this.clientCache) {
      this.clientCache = await createClient('localhost:5000');
    }
    return this.clientCache;
  }

  async run() {
    const {push, reject, complete, out} = asyncStream<void>();
    const client = await this.getClient();
    const scheduleCall = client.FollowGameSchedule({ scheduleId: this.gameScheduleID });

    let opened = 0;
    let closed = 0;
    scheduleCall.on('data', (scheduleResponse: FollowGameScheduleResponse) => {
      const gameCall = client.FollowGame();

      gameCall.on('error', (error) => {
        scheduleCall.cancel();
        console.log('errpr on gamecall')
        reject(error);
      });
      gameCall.on('end', () => {
        gameCall.end();
      })

      // // @ts-ignore
      const playCall = client.PlayGame(new grpc.Metadata(), (error, result) => {
        if (error) {
          reject(error);
        }
      });

      let gameState: GS = null;
      let playerNumber: number = null;
      gameCall.on('data', (gameResponse: FollowGameResponse) => {
        if ('game' in gameResponse) {
          gameState = JSON.parse(gameResponse.game.gameState);
          const assignments = gameResponse.game.assignments;
          playerNumber = assignments.find((assignment) => assignment.playerId === this.playerID).playerNumber;
        } else {
          jsonpatch.applyPatch(gameState, JSON.parse(gameResponse.patch.patch) as any, false, true);
        }
        if (gameState.end) {
          gameCall.end();
          playCall.end();
          push();
        } else {
          if (gameState.players[playerNumber].playing) {
            const action = this.ai.run(gameState, playerNumber);

            const playMessage = { gameId: scheduleResponse.schedule.gameId, playerId: this.playerID, action: action.name, data: JSON.stringify(action.data) };

            playCall.write(playMessage);
          }
        }
      });

      gameCall.write({ gameId: scheduleResponse.schedule.gameId });
    });
    scheduleCall.on('error', (error) => {
      console.log('error on scheduleCall');
      // FIXME: end every grpc connection
      reject(error);
    });
    return out();
  }
}