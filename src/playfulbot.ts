import { SubscriptionClient } from "subscriptions-transport-ws";
import gql from 'graphql-tag';
import { execute } from '@apollo/client/link/core';
import { toPromise } from '@apollo/client/link/utils';
import { WebSocketLink } from "@apollo/client/link/ws";
import ws from 'ws';

import jwt, { JsonWebTokenError } from 'jsonwebtoken';

import * as jsonpatch from 'fast-json-patch';

import { GameState, GameAction, BotAI } from "./types";
import { observableToAsyncGenerator } from './utils/async';


const GRAPHQL_ENDPOINT = "ws://localhost:4000/graphql";

export class PlayfulBot<GS extends GameState> {
  client: SubscriptionClient;
  link: WebSocketLink;
  gameID: string;
  playerNumber: number;
  ai: BotAI<GS>;

  constructor(token: string, botAI: BotAI<GS>) {
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

    const { playerNumber, game } = jwt.decode(token, {json: true});
    this.playerNumber = playerNumber;
    this.gameID = game;

    this.ai = botAI;
  }


  async run() {
    for await (const gameState of this.gameStates()) {
      const action = this.ai.run(gameState);
      await this.play(action.name, action.data);
    }
  }


  async play(action: any, data: any) {
    const playMutation = {
      query: gql`
        mutation Play($gameID: ID!, $player: Int!, $action: String!, $data: JSON!) {
          play(gameID: $gameID, player: $player, action: $action, data: $data)
        }
      `,
      variables: {gameID: this.gameID, player: this.playerNumber, action: action, data: data},
    };
    
    return toPromise(execute(this.link, playMutation));
  }

  async *gameStates(): AsyncGenerator<GS, void, unknown> {
    console.log("running")
    const gameQuery = {
      query: gql`
      query GetGame {
        game {
          id
          players {
            playerNumber, token
          }
          version
          gameState
          }
      }
    `,
    };

    const gameResponse = await toPromise(execute(this.link, gameQuery));

    const gameID = gameResponse?.data?.game.id;
    if (!gameID) {
      throw new Error("Game could not be retrieved");
    }
    let gameState = gameResponse.data.game.gameState;
    
    const gamePatchSubscription = {
      query: gql`
        subscription onGameChanges($gameID: ID!) {
          gamePatch(gameID: $gameID) {
            patch, version
          }
        }
      `,
      variables: {gameID: gameID},
    };

    const patches: any = observableToAsyncGenerator(execute(this.link, gamePatchSubscription))

    if (gameState.players[this.playerNumber].playing) {
      yield gameState;
    }
    
    for await (const patch of patches) {
      jsonpatch.applyPatch(gameState, patch.data.gamePatch.patch, false, true);
      if (gameState.players[this.playerNumber].playing) {
        yield gameState;
      }
    }
  }
}
