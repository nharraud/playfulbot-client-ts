import { PlayfulBot } from "./playfulbot";
import { PlayfulBotGrpc } from "./playfulbotGrpc";
import { WallRaceAI } from "./wallrace/ai";
import { WallRaceGameState } from "./wallrace/types";

import jwt from 'jsonwebtoken';

import { GameScheduler } from './GameScheduler';
import { exit } from "process";


async function *runDebugGame(userID: string, graphqlEndpoint: string, grpcEndpoint: string): AsyncGenerator<number, void, unknown> {

  const SECRET_KEY = 'secret!';
  const token1 = jwt.sign({ playerID: 'player_0', gameScheduleID: userID }, SECRET_KEY);
  const token2 = jwt.sign({ playerID: 'player_1', gameScheduleID: userID }, SECRET_KEY);


  const scheduler = new GameScheduler(token1, graphqlEndpoint);
  await scheduler.createNewDebugGame();
  const ai1 = new WallRaceAI();
  // const bot1 = new PlayfulBot<WallRaceGameState>(token1, ai1, graphqlEndpoint);
  const bot1 = new PlayfulBotGrpc<WallRaceGameState>(grpcEndpoint, token1, ai1, graphqlEndpoint);

  const ai2 = new WallRaceAI();
  // const bot2 = new PlayfulBot<WallRaceGameState>(token2, ai2, graphqlEndpoint);
  const bot2 = new PlayfulBotGrpc<WallRaceGameState>(grpcEndpoint, token2, ai2, graphqlEndpoint);


  // const iterBot1 = bot1.run();
  // const iterBot2 = bot2.run();
  const iterBot1 = await bot1.run();
  const iterBot2 = await bot2.run();

  let timeSlot = Math.floor(new Date().getTime() / 10000);
  let counter = 0;

  while (true) {
    await Promise.all([
      iterBot1.next(),
      iterBot2.next(),
    ]);
    await scheduler.createNewDebugGame();

    let now = Math.floor(new Date().getTime() / 10000);
    if (timeSlot === now) {
      counter += 1;
    } else {
      yield counter;
      timeSlot = now;
      counter = 0;
    }
  }
}

async function benchmark(start: number, end: number, graphqlEndpoint: string, grpcEndpoint: string) {
  const playedGames = [];
  for (let idx = start; idx < end; idx += 1) {
    let userNB = idx.toString(16);
    if (userNB.length < 2) {
      userNB = `0${userNB}`;
    }
  
    const iterator = runDebugGame(`00000000-0000-0000-0000-000000000e${userNB}`, graphqlEndpoint, grpcEndpoint)
    playedGames.push(iterator);
  }

  while (true) {
    const allGamesPlayed = await Promise.all(playedGames.map((iter) => iter.next()));
    const count = allGamesPlayed.reduce((sum, gameCount) => sum + (gameCount.value as number), 0);
    const meanGamesPerSecond = count / allGamesPlayed.length / 10;
    console.log(`Mean number of games per second: ${meanGamesPerSecond}    Number of games running: ${end - start}`);
  }

}

const START = parseInt(process.env['START']) || 0;
const END = parseInt(process.env['END']) || 1;

let graphqlPort = 4000;
if (process.env.GRAPHQL_PORT) {
  graphqlPort = parseInt(process.env.GRAPHQL_PORT, 10);
}

let grpcPort = 5000;
if (process.env.GRPC_PORT) {
  grpcPort = parseInt(process.env.GRPC_PORT, 10);
}

let host = 'localhost';
if (process.env.HOST) {
  host = process.env.HOST;
}

const GRAPHQL_ENDPOINT = `ws://${host}:${graphqlPort}/graphql`;
const GRPC_ENDPOINT = `${host}:${grpcPort}`;

benchmark(START, END, GRAPHQL_ENDPOINT, GRPC_ENDPOINT).catch((reason) => {
  console.log(reason);
  exit();
})
