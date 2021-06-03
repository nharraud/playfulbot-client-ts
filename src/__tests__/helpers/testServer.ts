import * as grpc from '@grpc/grpc-js';
import { PlayfulBotHandlers } from '../../grpc/types/playfulbot/v0/PlayfulBot';
import { proto } from '../../grpc/client';
import { testGameInit } from './gameFixture';
import { FollowGameRequest } from '../../grpc/types/playfulbot/v0/FollowGameRequest';


grpc.credentials.createSsl = grpc.credentials.createInsecure;

export class MockPlayfulBotHandler implements PlayfulBotHandlers {
  [name: string]: grpc.UntypedHandleCall;
  FollowPlayerGames = jest.fn().mockImplementation((call) => {
    call.write({
      games: ['game0'],
    });
    call.end();
  }) as jest.MockedFunction<PlayfulBotHandlers['FollowPlayerGames']>;
  FollowGame = jest.fn().mockImplementation((call) => {
    call.on('data', (data: FollowGameRequest) => {
      call.write({
        game: {
          ...testGameInit,
          id: data.gameId,
        }
      });
      call.end();
    });
  }) as jest.MockedFunction<PlayfulBotHandlers['FollowGame']>;
  PlayGame = jest.fn()  as jest.MockedFunction<PlayfulBotHandlers['PlayGame']>;
}

function createTestServer(handlers: PlayfulBotHandlers): grpc.Server {
  const server = new grpc.Server({
    'grpc.max_concurrent_streams': 120,
  });

  server.addService(proto.playfulbot.v0.PlayfulBot.service, handlers);
  return server;
}

const serverInsecureCreds = grpc.ServerCredentials.createInsecure();

export function createTestServerAndClient(
  handlers: PlayfulBotHandlers,
  callback: (server: grpc.Server, endpoint: string) => Promise<void>
): Promise<void> {
  const server = createTestServer(handlers);

  return new Promise(async (resolve, reject) => {
    server.bindAsync('localhost:0', serverInsecureCreds, (err: Error | null, port: number) => {
      if (err) {
        reject(err);
      } else {
        server.start();
        resolve(callback(server, `localhost:${port}`)
        .finally(() => {
          server.forceShutdown();
        }));
      }
    });
  })
}

