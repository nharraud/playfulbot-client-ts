import { SubscriptionClient } from "subscriptions-transport-ws";
import gql from 'graphql-tag';
import { execute } from '@apollo/client/link/core';
import { toPromise } from '@apollo/client/link/utils';
import { WebSocketLink } from "@apollo/client/link/ws";
import ws from 'ws';

import jwt from 'jsonwebtoken';

import { GameState, BotAI, PlayerAssignment } from "./types";
import { observableToAsyncGenerator } from './utils/async';
import { PlayedGame } from "./utils/game";

export class PlayfulBot<GS extends GameState> {
  client: SubscriptionClient;
  link: WebSocketLink;
  ai: BotAI<GS>;
  playerID: string;
  gameScheduleID: string;

  constructor(token: string, botAI: BotAI<GS>, graphqlEndpoint: string) {
    this.client = new SubscriptionClient(graphqlEndpoint, {
      reconnect: true,
      lazy: true,
      connectionParams: async () => {
        return {
          authToken: token,
        }
      },
    }, ws);
    this.client.onError((err) => console.log('onError', { err }));

    this.link = new WebSocketLink(this.client);

    const { playerID, gameScheduleID } = jwt.decode(token, {json: true});
    this.playerID = playerID;
    this.gameScheduleID = gameScheduleID;

    this.ai = botAI;
  }


  async *run(): AsyncGenerator<void, void, unknown> {
    for await (const game of this.games()) {
      for await (const gameState of game.gameStates()) {
        const action = this.ai.run(gameState, game.playerNumber);
        await this.play(game, action.name, action.data);
      }
      yield;
    }
  }

  async play(game: PlayedGame<GS>, action: any, data: any) {
    const playMutation = {
      query: gql`
        mutation Play($gameID: ID!, $playerID: ID!, $action: String!, $data: JSON!) {
          play(gameID: $gameID, playerID: $playerID, action: $action, data: $data)
        }
      `,
      variables: {gameID: game.gameID, playerID: this.playerID, action: action, data: data},
    };
    
    return toPromise(execute(this.link, playMutation));
  }

  async *games(): AsyncGenerator<PlayedGame<GS>, void, unknown> {
    const GAME_SCHEDULE_QUERY = {
      query: gql`
        query getGameSchedule($scheduleID: ID!) {
          gameSchedule(scheduleID: $scheduleID) {
            id
            players {
              id, token
            }
            game {
              id
              version,
              assignments {
                playerID, playerNumber
              }
              gameState
            }
          }
        }
      `,
      variables: { scheduleID: this.gameScheduleID }
    };

    const GAME_SCHEDULE_SUBSCRIPTION = {
      query: gql`
        subscription onGameScheduleChanges($scheduleID: ID!) {
          gameScheduleChanges(scheduleID: $scheduleID) {
            id
            players {
              id, token
            }
            game {
              id
              version,
              assignments {
                playerID, playerNumber
              }
              gameState
            }
          }
        }
      `,
      variables: { scheduleID: this.gameScheduleID }
    };

    const scheduledGames: any = observableToAsyncGenerator(execute(this.link, GAME_SCHEDULE_SUBSCRIPTION))

    let gameScheduleResponse = await toPromise(execute(this.link, GAME_SCHEDULE_QUERY));

    if (!gameScheduleResponse?.data?.gameSchedule?.id) {
      console.log(JSON.stringify(gameScheduleResponse, null, 2))
      throw new Error("Game Schedule could not be retrieved");
    }
    const assignments: PlayerAssignment[] = gameScheduleResponse.data.gameSchedule.game.assignments;
    const playerNumber = assignments.find((assignment) => assignment.playerID === this.playerID).playerNumber;
    yield new PlayedGame<GS>(gameScheduleResponse.data.gameSchedule.game.id, playerNumber, this.link)

    for await (const scheduledGame of scheduledGames) {
      if (gameScheduleResponse.data.gameSchedule.game.id === scheduledGame.data.gameScheduleChanges.game.id) {
        continue;
      }
      yield new PlayedGame<GS>(scheduledGame.data.gameScheduleChanges.game.id, playerNumber, this.link)
    }

  }

}
