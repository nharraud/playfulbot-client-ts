import { WebSocketLink } from "@apollo/client/link/ws";
import { SubscriptionClient } from "subscriptions-transport-ws";
import { execute } from '@apollo/client/link/core';
import ws from 'ws';
import jwt from 'jsonwebtoken';
import gql from 'graphql-tag';
import { toPromise } from "@apollo/client/core";


export class GameScheduler {
  client: SubscriptionClient;
  link: WebSocketLink;
  gameScheduleID: string;

  constructor(token: string, graphqlEndpoint: string) {
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

    const { gameScheduleID } = jwt.decode(token, {json: true});
    this.gameScheduleID = gameScheduleID
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
      variables: {userID: this.gameScheduleID}
    };
    return toPromise(execute(this.link, NEW_DEBUG_GAME_MUTATION));
  }
}