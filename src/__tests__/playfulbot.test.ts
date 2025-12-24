import { describe, test, expect, vitest, MockedFunction } from 'vitest';
import { PlayfulBot } from "../playfulbot";
import { noopActionName, NoopAI, noopData } from "./helpers/aiFixture";
import { createTestServersAndClient, MockBackendHandler, MockRunnerHandler } from "./helpers/testServers";
import * as grpc from '@grpc/grpc-js';
import { testGameInit } from "./helpers/gameFixture";
import { AsyncStream, DeferredPromise } from "./helpers/AsyncStream";
import { PlayGameRequest } from '../grpc/types/playfulbot_runner/v0/PlayGameRequest';
import { FollowGameRequest } from '../grpc/types/playfulbot_runner/v0/FollowGameRequest';
import { GameState } from '../types';

describe('PlayfulBot', () => {
  const token = 'mytoken';

  test('should send authentication token to FollowPlayerGames', async () => {
    const backendHandler = new MockBackendHandler();
    const runnerHandler = new MockRunnerHandler();
    let receivedMetadata: grpc.Metadata;
    backendHandler.FollowPlayerGames.mockImplementation((call) => {
      receivedMetadata = call.metadata;
      call.end();
    });
    await createTestServersAndClient({ backend: backendHandler, runner: runnerHandler }, async (servers) => {
      const bot = new PlayfulBot(token, new NoopAI(), servers.backend.endpoint);
      await bot.run();
      expect(receivedMetadata.get('authorization')).toEqual(expect.arrayContaining([token]));
    })
  });

  test('should send authentication token to FollowGame', async () => {
    const defPromise = new DeferredPromise<{ id: string, url: string}[][]>();
    const backendHandler = new MockBackendHandler(defPromise.promise);
    const runnerHandler = new MockRunnerHandler();
    let receivedMetadata: grpc.Metadata;
    runnerHandler.FollowGame.mockImplementation((call) => {
      receivedMetadata = call.metadata;
      call.end();
    });
    await createTestServersAndClient({ backend: backendHandler, runner: runnerHandler }, async (servers) => {
      defPromise.resolve([[{ url: servers.runner.endpoint, id: 'game0'}]]);
      const bot = new PlayfulBot(token, new NoopAI(), servers.backend.endpoint)
      await bot.run();
      expect(receivedMetadata.get('authorization')).toEqual(expect.arrayContaining([token]));
    })
  });

  test('should send authentication token to PlayGame', async () => {
    const defPromise = new DeferredPromise<{ id: string, url: string}[][]>();
    const backendHandler = new MockBackendHandler(defPromise.promise);
    const runnerHandler = new MockRunnerHandler();
    let receivedMetadata: grpc.Metadata;
    runnerHandler.PlayGame.mockImplementation((call) => {
      receivedMetadata = call.metadata;
    });
    await createTestServersAndClient({ backend: backendHandler, runner: runnerHandler }, async (servers) => {
      defPromise.resolve([[{ url: servers.runner.endpoint, id: 'game0'}]]);
      const bot = new PlayfulBot(token, new NoopAI(), servers.backend.endpoint)
      await bot.run();
      expect(receivedMetadata.get('authorization')).toEqual(expect.arrayContaining([token]));
    })
  });

  test('should stop the bot when an error occurs from following player\'s games', async () => {
    const backendHandler = new MockBackendHandler();
    const runnerHandler = new MockRunnerHandler();
    backendHandler.FollowPlayerGames.mockImplementation((call) => {
      call.emit('error', { code: grpc.status.ABORTED, message: 'expected error' });
    });
    await createTestServersAndClient({ backend: backendHandler, runner: runnerHandler }, async (servers) => {
      const bot = new PlayfulBot(token, new NoopAI(), servers.backend.endpoint)
      const promise = bot.run();
      return expect(promise).rejects.toThrow(expect.objectContaining(
        { code: grpc.status.ABORTED, details: 'expected error' }
      ));
    });
  });

  test('should stop the bot when an error occurs from following a specific game', async () => {
    const defPromise = new DeferredPromise<{ id: string, url: string}[][]>();
    const backendHandler = new MockBackendHandler(defPromise.promise);
    const runnerHandler = new MockRunnerHandler();
    runnerHandler.FollowGame.mockImplementation((call) => {
      call.emit('error', { code: grpc.status.ABORTED, message: 'expected error' });
    });
    await createTestServersAndClient({ backend: backendHandler, runner: runnerHandler }, async (servers) => {
      defPromise.resolve([[{ url: servers.runner.endpoint, id: 'game0'}]]);
      const bot = new PlayfulBot(token, new NoopAI(), servers.backend.endpoint)
      const promise = bot.run();
      return expect(promise).rejects.toThrow(expect.objectContaining(
        { code: grpc.status.ABORTED, details: 'expected error' }
      ));
    });
  });

  test('should stop the bot when an error occurs during play', async () => {
    const defPromise = new DeferredPromise<{ id: string, url: string}[][]>();
    const backendHandler = new MockBackendHandler(defPromise.promise);
    const runnerHandler = new MockRunnerHandler();
    runnerHandler.PlayGame.mockImplementation((call, callback) => {
      callback({ code: grpc.status.ABORTED, message: 'expected error' });
    });
    await createTestServersAndClient({ backend: backendHandler, runner: runnerHandler }, async (servers) => {
      defPromise.resolve([[{ url: servers.runner.endpoint, id: 'game0'}]]);
      const bot = new PlayfulBot(token, new NoopAI(), servers.backend.endpoint)
      const promise = bot.run();
      return expect(promise).rejects.toThrow(expect.objectContaining(
        { code: grpc.status.ABORTED, details: 'expected error' }
      ));
    });
  });

  test('should forward ai actions when playing games', async () => {
    const defPromise = new DeferredPromise<{ id: string, url: string}[][]>();
    const backendHandler = new MockBackendHandler(defPromise.promise);
    const runnerHandler = new MockRunnerHandler();
    const requestPromise = new Promise<PlayGameRequest>((resolve) => {
      runnerHandler.PlayGame.mockImplementation((call) => {
        call.on('data', (requestParam: PlayGameRequest) => {
          resolve(requestParam);
        });
      });
    })
    runnerHandler.FollowGame.mockImplementation((call) => {
      call.write({
        game: testGameInit
      });
      requestPromise.then(() => call.end());
    })
    await createTestServersAndClient({ backend: backendHandler, runner: runnerHandler }, async (servers) => {
      defPromise.resolve([[{ url: servers.runner.endpoint, id: 'game0'}]]);
      const bot = new PlayfulBot(token, new NoopAI(), servers.backend.endpoint)
      await bot.run();
      const request = await requestPromise;
      expect(request).toMatchObject({
        gameId: testGameInit.id,
        data: JSON.stringify({ name: noopActionName, data: noopData }),
      });
    });
  });

  test('should be able to play multiple games', async () => {
    const defPromise = new DeferredPromise<{ id: string, url: string}[][]>();
    const backendHandler = new MockBackendHandler(defPromise.promise);
    const runnerHandler = new MockRunnerHandler();
    const playedGames = new Array<string>();
    runnerHandler.FollowGame.mockImplementation((call) => {
      call.on('data', (data: FollowGameRequest) => {
        call.write({
          game: {
            ...testGameInit,
            id: data.gameId,
          }
        });
      });
      call.on('end', () => call.end());
    });
    runnerHandler.PlayGame.mockImplementation((call, callback) => {
      call.on('data', (requestParam: PlayGameRequest) => {
        playedGames.push(requestParam.gameId as string);
        callback(null);
      });
    });
    await createTestServersAndClient({ backend: backendHandler, runner: runnerHandler }, async (servers) => {
      defPromise.resolve([
        [{ url: servers.runner.endpoint, id: 'game0'}],
        [{ url: servers.runner.endpoint, id: 'game1'}, { url: servers.runner.endpoint, id: 'game2'}],
        [{ url: servers.runner.endpoint, id: 'game3'}],
      ]);
      const bot = new PlayfulBot(token, new NoopAI(), servers.backend.endpoint)
      await bot.run();
      expect(playedGames).toHaveLength(4);
      expect(playedGames).toEqual(expect.arrayContaining(['game0', 'game1', 'game2', 'game3']));
    });
  });

  test('should stop following and playing game when it ends', async () => {
    const defPromise = new DeferredPromise<{ id: string, url: string}[][]>();
    const backendHandler = new MockBackendHandler(defPromise.promise);
    const runnerHandler = new MockRunnerHandler();
    let followGameClosed = false;
    let playGameClosed = false;
    const played = new Promise<void>((resolve) => {
      runnerHandler.PlayGame.mockImplementation((call, callback) => {
        call.on('end', () => {
          callback(null, {});
        });
        call.on('close', () => {
          playGameClosed = true;
        });
        call.on('data', (requestParam: PlayGameRequest) => {
          resolve();
        });
      });
    })
    runnerHandler.FollowGame.mockImplementation((call) => {
      call.on('end', () => {
        call.end();
      });
      call.on('data', () => {
        // 'end' event is not triggered if 'data' event is not listened to
      });
      call.on('close', () => {
        followGameClosed = true;
      })
      call.write({
        game: testGameInit
      });
      played.then(() => {
        call.write({
          patch: {
            gameId: testGameInit.id,
            version: 1,
            patch: JSON.stringify([{ "op": "replace", "path": "/end", "value": true },])
          }
        });
      });
    })
    await createTestServersAndClient({ backend: backendHandler, runner: runnerHandler }, async (servers) => {
      defPromise.resolve([[{ url: servers.runner.endpoint, id: 'game0'}]]);
      const bot = new PlayfulBot(token, new NoopAI(), servers.backend.endpoint)
      await bot.run();
      expect(playGameClosed).toBeTruthy();
      expect(followGameClosed).toBeTruthy();
    });
  });

  test('should play game until the end', async () => {
    const defPromise = new DeferredPromise<{ id: string, url: string}[][]>();
    const backendHandler = new MockBackendHandler(defPromise.promise);
    const runnerHandler = new MockRunnerHandler();
    const playStream = new AsyncStream<number>();
    let playCounter = 0;
    runnerHandler.PlayGame.mockImplementation((call, callback) => {
      call.on('end', () => {
        callback(null, {});
      });
      call.on('data', (requestParam: PlayGameRequest) => {
        playStream.push(playCounter++);
      });
    });
    runnerHandler.FollowGame.mockImplementation((call) => {
      call.on('end', () => {
        call.end();
      });
      call.on('data', () => {
        // 'end' event is not triggered if 'data' event is not listened to
      });
      call.write({
        game: testGameInit
      });
      playStream.next().then(function reactToPlay(playCount) {
        if (playCount.value !== undefined && playCount.value < 4) {
          playStream.next().then(reactToPlay);
          call.write({
            patch: {
              gameId: testGameInit.id,
              version: 1,
              patch: JSON.stringify([{ "op": "test", "path": "/end", "value": false },])
            }
          });
        } else {
          playStream.complete();
          call.write({
            patch: {
              gameId: testGameInit.id,
              version: 2,
              patch: JSON.stringify([{ "op": "replace", "path": "/end", "value": true },])
            }
          });
        }
      });
    })
    await createTestServersAndClient({ backend: backendHandler, runner: runnerHandler }, async (servers) => {
      defPromise.resolve([[{ url: servers.runner.endpoint, id: 'game0'}]]);
      const bot = new PlayfulBot(token, new NoopAI(), servers.backend.endpoint)
      await bot.run();
      expect(playCounter).toEqual(5);
    });
  });

  test('should play only when it is player\'s turn', async () => {
    const playedStates = new Array<GameState>();
    class AIMock extends NoopAI {
      run = vitest.fn().mockImplementation((gameState: GameState, playerNumber: number) => {
        playedStates.push(JSON.parse(JSON.stringify(gameState)));
        return {
          name: noopActionName,
          data: noopData,
        }
      }) as MockedFunction<NoopAI['run']>;
    }
    const defPromise = new DeferredPromise<{ id: string, url: string}[][]>();
    const backendHandler = new MockBackendHandler(defPromise.promise);
    const runnerHandler = new MockRunnerHandler();
    runnerHandler.FollowGame.mockImplementation(async (call) => {
      call.on('end', () => {
        call.end();
      });
      call.on('data', () => {
        // 'end' event is not triggered if 'data' event is not listened to
      });
      call.write({
        game: {
          ...testGameInit,
          player: 0,
          gameState: JSON.stringify({
            end: false,
            players: [{
              // not the player's turn
              playing: false,
            },
            {
              playing: true,
            }]
          })
        }
      });
      await new Promise(resolve => setTimeout(resolve, 100));
      call.write({
        patch: {
          gameId: testGameInit.id,
          version: 1,
          patch: JSON.stringify([
            // no it's player's turn
            { "op": "replace", "path": "/players/0/playing", "value": true },
            { "op": "replace", "path": "/players/1/playing", "value": false },
          ])
        }
      });
      call.write({
        patch: {
          gameId: testGameInit.id,
          version: 2,
          patch: JSON.stringify([{ "op": "replace", "path": "/end", "value": true },])
        }
      });
    })
    await createTestServersAndClient({ backend: backendHandler, runner: runnerHandler }, async (servers) => {
      defPromise.resolve([[{ url: servers.runner.endpoint, id: 'game0'}]]);
      const ai = new AIMock();
      const bot = new PlayfulBot(token, ai, servers.backend.endpoint)
      await bot.run();
      expect(ai.run).toHaveBeenCalledTimes(1);
      expect(playedStates).toEqual(
        expect.arrayContaining([{
          end: false,
          players: [{
            playing: true,
          },
          {
            playing: false,
          }]
        }])
      );
    });
  });

  test('should canceled games should be stopped', async () => {
    const defPromise = new DeferredPromise<{ id: string, url: string}[][]>();
    const backendHandler = new MockBackendHandler(defPromise.promise);
    const runnerHandler = new MockRunnerHandler();
    runnerHandler.FollowGame.mockImplementation((call) => {
      call.on('end', () => {
        call.end();
      });
      call.on('data', () => {
        // 'end' event is not triggered if 'data' event is not listened to
      });
      call.write({
        game: testGameInit
      });
      call.write({
        canceled: {
          gameId: testGameInit.id,
          version: 2
        }
      });
    });
    await createTestServersAndClient({ backend: backendHandler, runner: runnerHandler }, async (servers) => {
      defPromise.resolve([[{ url: servers.runner.endpoint, id: 'game0'}]]);
      const bot = new PlayfulBot(token, new NoopAI(), servers.backend.endpoint)
      await bot.run();
      // The game is stopped and the "run" promise ends.
    });
  });
});
