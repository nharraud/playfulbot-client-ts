import { PlayfulBot } from "./playfulbot";
import { PlayfulBotGrpc } from "./playfulbotGrpc";
import { WallRaceAI } from "./wallrace/ai";
import { WallRaceGameState } from "./wallrace/types";

import jwt from 'jsonwebtoken';

import { GameScheduler } from './GameScheduler';
import { exit } from "process";

function createDebugPlayerID(tournamentID: string, userID: string, playerNumber: number) {
  const debugArenaID = `${tournamentID}_${userID}`;
  return `${debugArenaID}_player${playerNumber}`;
}

function createTeamPlayerID(teamID: string) {
  return `${teamID}`;
}

function numberToHexString(nb: number, length: number) {
  const strNb = nb.toString(16);
  if (strNb.length < length) {
    const prefix = '0'.repeat(length - strNb.length);
    return `${prefix}${strNb}`;
  }
  if (strNb.length === length) {
    return strNb;
  }
  throw new Error('number to big for the given string length');
}

function createToken(tournamentID: string, userID: string, playerNumber: number) {
  const SECRET_KEY = 'secret!';
  const playerID = createDebugPlayerID(tournamentID, userID, playerNumber);
  return jwt.sign({ playerID: playerID }, SECRET_KEY);
}

async function *runDebugGame(tournamentID: string, userID: string, graphqlEndpoint: string, grpcEndpoint: string): AsyncGenerator<number, void, unknown> {
  const token1 = createToken(tournamentID, userID, 0);
  const token2 = createToken(tournamentID, userID, 1);


  const scheduler = new GameScheduler(tournamentID, userID, token1, graphqlEndpoint);
  // await scheduler.createNewDebugGame();
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
    const result = await scheduler.createNewDebugGame();

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
  const tournamentID = `f00fabe0-0000-0000-0000-000000000001`;
  for (let idx = start; idx < end; idx += 1) {
    // let userNB = idx.toString(16);
    // if (userNB.length < 2) {
    //   userNB = `0${userNB}`;
    // }
    const userNB = numberToHexString(idx, 12);
    const userID = `aceb0000-0000-0000-0000-${userNB}`; //`00000000-0000-0000-0000-000000000e${userNB}`
  
    const iterator = runDebugGame(tournamentID, userID, graphqlEndpoint, grpcEndpoint)
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
