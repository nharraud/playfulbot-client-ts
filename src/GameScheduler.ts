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
  playerID: string;
  tournamentID: string;
  userID: string;

  constructor(tournamentID: string, userID: string, token: string, graphqlEndpoint: string) {
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

    const { playerID } = jwt.decode(token, {json: true});
    this.playerID = playerID;
    this.tournamentID = tournamentID;
    this.userID = userID;
  }

  async createNewDebugGame() {
    const NEW_DEBUG_GAME_MUTATION = {
      query: gql`
        mutation createNewDebugGame($tournamentID: ID!, $userID: ID!) {
          createNewDebugGame(tournamentID: $tournamentID, userID: $userID)
        }
      `,
      variables: { userID: this.userID, tournamentID: this.tournamentID }
    };
    return toPromise(execute(this.link, NEW_DEBUG_GAME_MUTATION));
  }
}