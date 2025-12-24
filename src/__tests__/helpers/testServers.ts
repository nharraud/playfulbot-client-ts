import * as grpc from '@grpc/grpc-js';
import { PlayfulBotHandlers } from '../../grpc/types/playfulbot_backend/v0/PlayfulBot';
import { PlayfulBotGameRunnerHandlers } from '../../grpc/types/playfulbot_runner/v0/PlayfulBotGameRunner';
import { backendProto, runnerProto } from '../../grpc/client';
import { testGameInit } from './gameFixture';
import { FollowGameRequest } from '../../grpc/types/playfulbot_runner/v0/FollowGameRequest';
import { vitest, MockedFunction } from 'vitest';

grpc.credentials.createSsl = grpc.credentials.createInsecure;


export class MockBackendHandler implements PlayfulBotHandlers {
  [name: string]: grpc.UntypedHandleCall;
  #games: Promise<{ id: string, url: string}[][]> | undefined;
  constructor(games: Promise<{ id: string, url: string}[][]> | undefined = undefined) {
    this.#games = games;
  }
  FollowPlayerGames = vitest.fn().mockImplementation(async (call) => {
    if (this.#games) {
      const allGames = await this.#games;
      for (const games of allGames) {
        call.write({
          games: games,
        });
      }
    } else {
      call.write({
        games: [],
      });
    }
    call.end();
  }) as MockedFunction<PlayfulBotHandlers['FollowPlayerGames']>
}

export class MockRunnerHandler implements PlayfulBotGameRunnerHandlers {
  [name: string]: grpc.UntypedHandleCall;
  FollowGame = vitest.fn().mockImplementation((call) => {
    call.on('data', (data: FollowGameRequest) => {
      call.write({
        game: {
          ...testGameInit,
          id: data.gameId,
        }
      });
      call.end();
    });
  }) as MockedFunction<PlayfulBotGameRunnerHandlers['FollowGame']>;
  PlayGame = vitest.fn()  as MockedFunction<PlayfulBotGameRunnerHandlers['PlayGame']>;
}

function createTestServers(handlers: { backend: PlayfulBotHandlers, runner: PlayfulBotGameRunnerHandlers }): { backend: grpc.Server, runner: grpc.Server } {
  const backendServer = new grpc.Server({
    'grpc.max_concurrent_streams': 120,
  });
  backendServer.addService(backendProto.playfulbot_backend.v0.PlayfulBot.service, handlers.backend);

  const runnerServer = new grpc.Server({
    'grpc.max_concurrent_streams': 120,
  });
  runnerServer.addService(runnerProto.playfulbot_runner.v0.PlayfulBotGameRunner.service, handlers.runner);
  return { backend: backendServer, runner: runnerServer };
}

const serverInsecureCreds = grpc.ServerCredentials.createInsecure();

export async function createTestServersAndClient(
  handlers: { backend: PlayfulBotHandlers, runner: PlayfulBotGameRunnerHandlers },
  callback: (params: { backend: { server: grpc.Server, endpoint: string }, runner: { server: grpc.Server, endpoint: string } }) => Promise<void>
): Promise<void> {
  const servers = createTestServers(handlers);

  function startServer(server: grpc.Server): Promise<string> {
    return new Promise(async (resolve, reject) => {
      server.bindAsync('localhost:0', serverInsecureCreds, (err: Error | null, port: number) => {
        if (err) {
          reject(err);
        } else {
          server.start();
          resolve(`localhost:${port}`);
        }
      });
    })
  }

  const backendEndpoint = await startServer(servers.backend);
  const runnerEndpoint = await startServer(servers.runner);

  try {
    await callback({
      backend: {
        server: servers.backend,
        endpoint: backendEndpoint,
      },
      runner: {
        server: servers.runner,
        endpoint: runnerEndpoint,
      }
    });
  } finally {
    servers.backend.forceShutdown();
    servers.runner.forceShutdown();
  }

}

