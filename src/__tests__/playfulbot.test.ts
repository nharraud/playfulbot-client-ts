import { PlayfulBot } from "../playfulbot";
import { noopActionName, NoopAI, noopData } from "./helpers/aiFixture";
import { createTestServerAndClient, MockPlayfulBotHandler } from "./helpers/testServer";
import * as grpc from '@grpc/grpc-js';
import { testGameInit } from "./helpers/gameFixture";
import { PlayGameRequest } from "../grpc/types/playfulbot/v0/PlayGameRequest";
import { FollowGameRequest } from "../grpc/types/playfulbot/v0/FollowGameRequest";
import { AsyncStream } from "./helpers/AsyncStream";
import { GameState } from "src/types";

describe('PlayfulBot', () => {
  const token = 'mytoken';

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should send authentication token to FollowPlayerGames', async () => {
    const serverHandler = new MockPlayfulBotHandler();
    let receivedMetadata: grpc.Metadata;
    serverHandler.FollowPlayerGames.mockImplementation((call) => {
      receivedMetadata = call.metadata;
      call.end();
    });
    return  createTestServerAndClient(serverHandler, async (server, endpoint) => {
      const bot = new PlayfulBot(token, new NoopAI(), endpoint)
      await bot.run();
      expect(receivedMetadata.get('authorization')).toEqual(expect.arrayContaining([token]));
    })
  });

  test('should send authentication token to FollowGame', async () => {
    const serverHandler = new MockPlayfulBotHandler();
    let receivedMetadata: grpc.Metadata;
    serverHandler.FollowGame.mockImplementation((call) => {
      receivedMetadata = call.metadata;
      call.end();
    });
    return  createTestServerAndClient(serverHandler, async (server, endpoint) => {
      const bot = new PlayfulBot(token, new NoopAI(), endpoint)
      await bot.run();
      expect(receivedMetadata.get('authorization')).toEqual(expect.arrayContaining([token]));
    })
  });

  test('should send authentication token to PlayGame', async () => {
    const serverHandler = new MockPlayfulBotHandler();
    let receivedMetadata: grpc.Metadata;
    serverHandler.PlayGame.mockImplementation((call) => {
      receivedMetadata = call.metadata;
    });
    return  createTestServerAndClient(serverHandler, async (server, endpoint) => {
      const bot = new PlayfulBot(token, new NoopAI(), endpoint)
      await bot.run();
      expect(receivedMetadata.get('authorization')).toEqual(expect.arrayContaining([token]));
    })
  });

  test('should stop the bot when an error occurs from following player\'s games', async () => {
    const serverHandler = new MockPlayfulBotHandler();
    serverHandler.FollowPlayerGames.mockImplementation((call) => {
      call.emit('error', { code: grpc.status.ABORTED, message: 'expected error' });
    });
    return  createTestServerAndClient(serverHandler, async (server, endpoint) => {
      const bot = new PlayfulBot(token, new NoopAI(), endpoint)
      const promise = bot.run();
      return expect(promise).rejects.toThrow(expect.objectContaining(
        { code: grpc.status.ABORTED, details: 'expected error' }
      ));
    });
  });

  test('should stop the bot when an error occurs from following a specific game', async () => {
    const serverHandler = new MockPlayfulBotHandler();
    serverHandler.FollowGame.mockImplementation((call) => {
      call.emit('error', { code: grpc.status.ABORTED, message: 'expected error' });
    });
    return  createTestServerAndClient(serverHandler, async (server, endpoint) => {
      const bot = new PlayfulBot(token, new NoopAI(), endpoint)
      const promise = bot.run();
      return expect(promise).rejects.toThrow(expect.objectContaining(
        { code: grpc.status.ABORTED, details: 'expected error' }
      ));
    });
  });

  test('should stop the bot when an error occurs during play', async () => {
    const serverHandler = new MockPlayfulBotHandler();
    serverHandler.PlayGame.mockImplementation((call, callback) => {
      callback({ code: grpc.status.ABORTED, message: 'expected error' });
    });
    return  createTestServerAndClient(serverHandler, async (server, endpoint) => {
      const bot = new PlayfulBot(token, new NoopAI(), endpoint)
      const promise = bot.run();
      return expect(promise).rejects.toThrow(expect.objectContaining(
        { code: grpc.status.ABORTED, details: 'expected error' }
      ));
    });
  });

  test('should forward ai actions when playing games', async () => {
    const serverHandler = new MockPlayfulBotHandler();
    const request = new Promise<PlayGameRequest>((resolve) => {
      serverHandler.PlayGame.mockImplementation((call) => {
        call.on('data', (requestParam: PlayGameRequest) => {
          resolve(requestParam);
        });
      });
    })
    serverHandler.FollowGame.mockImplementation((call) => {
      call.write({
        game: testGameInit
      });
      request.then(() => call.end());
    })
    return  createTestServerAndClient(serverHandler, async (server, endpoint) => {
      const bot = new PlayfulBot(token, new NoopAI(), endpoint)
      await bot.run();
      expect(request).resolves.toMatchObject(
        {
          gameId: testGameInit.id,
          data: JSON.stringify(noopData),
        }
      );
    });
  });

  test('should be able to play multiple games', async () => {
    const serverHandler = new MockPlayfulBotHandler();
    const playedGames = new Array<string>();
    serverHandler.FollowPlayerGames.mockImplementation((call) => {
      call.write({
        games: ['game0'],
      });
      call.write({
        games: ['game1', 'game2'],
      });

      call.write({
        games: ['game3'],
      });
      call.end();
    });
    serverHandler.FollowGame.mockImplementation((call) => {
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
    serverHandler.PlayGame.mockImplementation((call, callback) => {
      call.on('data', (requestParam: PlayGameRequest) => {
        playedGames.push(requestParam.gameId);
        callback(null);
      });
    });
    return  createTestServerAndClient(serverHandler, async (server, endpoint) => {
      const bot = new PlayfulBot(token, new NoopAI(), endpoint)
      await bot.run();
      expect(playedGames).toHaveLength(4);
      expect(playedGames).toEqual(expect.arrayContaining(['game0', 'game1', 'game2', 'game3']));
    });
  });

  test('should stop following and playing game when it ends', async () => {
    const serverHandler = new MockPlayfulBotHandler();
    let followGameClosed = false;
    let playGameClosed = false;
    const played = new Promise<void>((resolve) => {
      serverHandler.PlayGame.mockImplementation((call, callback) => {
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
    serverHandler.FollowGame.mockImplementation((call) => {
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
    return  createTestServerAndClient(serverHandler, async (server, endpoint) => {
      const bot = new PlayfulBot(token, new NoopAI(), endpoint)
      await bot.run();
      expect(playGameClosed).toBeTruthy();
      expect(followGameClosed).toBeTruthy();
    });
  });

  test('should play game until the end', async () => {
    const serverHandler = new MockPlayfulBotHandler();
    const playStream = new AsyncStream<number>();
    let playCounter = 0;
    serverHandler.PlayGame.mockImplementation((call, callback) => {
      call.on('end', () => {
        callback(null, {});
      });
      call.on('data', (requestParam: PlayGameRequest) => {
        playStream.push(playCounter++);
      });
    });
    serverHandler.FollowGame.mockImplementation((call) => {
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
        if (playCount.value < 4) {
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
    return  createTestServerAndClient(serverHandler, async (server, endpoint) => {
      const bot = new PlayfulBot(token, new NoopAI(), endpoint)
      await bot.run();
      expect(playCounter).toEqual(5);
    });
  });

  test('should play only when it is player\'s turn', async () => {
    jest.mock('./helpers/aiFixture');
    const playedStates = new Array<GameState>();
    class AIMock extends NoopAI {
      run = jest.fn().mockImplementation((gameState: GameState, playerNumber: number) => {
        playedStates.push(JSON.parse(JSON.stringify(gameState)));
        return {
          name: noopActionName,
          data: noopData,
        }
      }) as jest.MockedFunction<NoopAI['run']>;
    }
    const serverHandler = new MockPlayfulBotHandler();
    serverHandler.FollowGame.mockImplementation((call) => {
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
              playing: false,
            },
            {
              playing: true,
            }]
          })
        }
      });
      call.write({
        patch: {
          gameId: testGameInit.id,
          version: 1,
          patch: JSON.stringify([
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
    return  createTestServerAndClient(serverHandler, async (server, endpoint) => {
      const ai = new AIMock();
      const bot = new PlayfulBot(token, ai, endpoint)
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
    const serverHandler = new MockPlayfulBotHandler();
    serverHandler.FollowGame.mockImplementation((call) => {
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
    })
    return  createTestServerAndClient(serverHandler, async (server, endpoint) => {
      const bot = new PlayfulBot(token, new NoopAI(), endpoint)
      await bot.run();
      // The game is stopped and the "run" promise ends.
    });
  });
});
