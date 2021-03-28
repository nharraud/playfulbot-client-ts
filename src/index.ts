import { PlayfulBot } from "./playfulbot";
import { WallRaceAI } from "./wallrace/ai";
import { WallRaceGameState } from "./wallrace/types";

import jwt from 'jsonwebtoken';


async function run(token: string, restart: boolean, graphqlEndpoint: string) {
  const ai = new WallRaceAI();
  const bot = new PlayfulBot<WallRaceGameState>(token, ai, graphqlEndpoint);

  await bot.run(restart);
}

async function runDebugGame(userID: string, graphqlEndpoint: string) {
  const SECRET_KEY = 'secret!';
  const token1 = jwt.sign({ playerID: 'player_0', gameScheduleID: userID }, SECRET_KEY);
  const token2 = jwt.sign({ playerID: 'player_1', gameScheduleID: userID }, SECRET_KEY);

  run(token1, true, graphqlEndpoint);
  run(token2, false, graphqlEndpoint);

  await Promise.allSettled([
    Promise.resolve('a'),
    Promise.reject('b')
  ])
}

const start = parseInt(process.env['START']) || 0;
const end = parseInt(process.env['END']) || 10;
for (let idx = start; idx < end; idx += 1) {
  let userNB = idx.toString(16);
  if (userNB.length < 2) {
    userNB = `0${userNB}`;
  }

  let graphqlPort = 4000;
  if (process.env.GRAPHQL_PORT) {
    graphqlPort = parseInt(process.env.GRAPHQL_PORT, 10);
  }

  let graphqlHost = 'localhost';
  if (process.env.GRAPHQL_HOST) {
    graphqlHost = process.env.GRAPHQL_HOST;
  }

  const GRAPHQL_ENDPOINT = `ws://${graphqlHost}:${graphqlPort}/graphql`;

  runDebugGame(`00000000-0000-0000-0000-000000000e${userNB}`, GRAPHQL_ENDPOINT)
  .catch((reason) => {
    console.log(reason);
  });
}