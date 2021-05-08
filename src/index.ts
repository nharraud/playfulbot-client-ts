import { PlayfulBotGrpc } from "./playfulbotGrpc";
import { WallRaceAI } from "./wallrace/ai";
import { WallRaceGameState } from "./wallrace/types";

let host = 'localhost';
if (process.env.HOST) {
  host = process.env.HOST;
}

let grpcPort = 5000;
if (process.env.GRPC_PORT) {
  grpcPort = parseInt(process.env.GRPC_PORT, 10);
}
const GRPC_ENDPOINT = `${host}:${grpcPort}`;
// const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwbGF5ZXJJRCI6ImZlYWIwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwMCIsImlhdCI6MTYxOTYzMzQ1Nn0.GBiYM72UuCBOYT0P98HY6pDYBDBhbBeOXGozBXQo4uQ';

const debugPlayer0 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwbGF5ZXJJRCI6ImYwMGZhYmUwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwMV9hY2ViMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDBfcGxheWVyMCIsImlhdCI6MTYyMDM4NTUyMn0.Wwu4LyktAiuEJyriYPGcAu_Upp6lEqv_arTcbAfTr64'
const debugPlayer1 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwbGF5ZXJJRCI6ImYwMGZhYmUwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwMV9hY2ViMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDBfcGxheWVyMSIsImlhdCI6MTYyMDM4NTUyMn0.b3hh_r3c1F3a6vjMzz2aqaxKhZ5ZJf-73RivgTWNXp4'
const ai = new WallRaceAI();
const bot1 = new PlayfulBotGrpc<WallRaceGameState>(GRPC_ENDPOINT, debugPlayer0, ai);
const bot2 = new PlayfulBotGrpc<WallRaceGameState>(GRPC_ENDPOINT, debugPlayer1, ai);

bot1.run().catch((reason) => {
  console.log(reason);
  process.exit(1);
})
bot2.run().catch((reason) => {
  console.log(reason);
  process.exit(1);
})