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


const GRAPHQL_ENDPOINT = "ws://localhost:4000/graphql";

export class PlayfulBot<GS extends GameState> {
  client: SubscriptionClient;
  link: WebSocketLink;
  ai: BotAI<GS>;
  playerID: string;
  gameScheduleID: string;
  counter: number;
  time: number;

  constructor(token: string, botAI: BotAI<GS>) {
    this.counter = 0;
    this.time = 0;
    this.client = new SubscriptionClient(GRAPHQL_ENDPOINT, {
      reconnect: true,
      lazy: true,
      connectionParams: async () => {
        return {
          authToken: token,
        }
      },
    }, ws);
    this.client.onError((err) => console.log('onError', { err }));
    this.client.onConnected((args) => console.log(`Success ${JSON.stringify(args)}`));

    this.link = new WebSocketLink(this.client);

    const { playerID, gameScheduleID } = jwt.decode(token, {json: true});
    this.playerID = playerID;
    this.gameScheduleID = gameScheduleID;

    this.ai = botAI;
  }


  async run(restart: boolean) {
    for await (const game of this.games()) {
      for await (const gameState of game.gameStates()) {
        const action = this.ai.run(gameState);
        const result = await this.play(game, action.name, action.data);
      }
      if (restart) {
        await this.createNewDebugGame()
      }
    }
  }

  async createNewDebugGame() {
    const NEW_DEBUG_GAME_MUTATION = {
      query: gql`
        mutation CreateNewDebugGameForUser($userID: ID!) {
          createNewDebugGameForUser(userID: $userID) {
            id
          }
        }
      `,
      variables: {userID: 'userID11'}
    };
    const now = Math.floor(new Date().getTime() / 1000);
    if (this.time === now) {
      this.counter += 1;
    } else {
      console.log(`create ${this.counter} games per second`)
      this.time = now;
      this.counter = 0;
    }
    return toPromise(execute(this.link, NEW_DEBUG_GAME_MUTATION));
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
