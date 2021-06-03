Playfulbot Client
=================

This library enables you to program a bot in javascript or typescript and let it play in a tournament on playfulbot.com.

Example
-------
```typescript
import { PlayfulBot, BotAI, GameAction, GameState } from 'playfulbot-client';

const token = 'Token copied from playfulbot website.' 

export class MyAI implements BotAI<GameState> {

  run(gameState: GameState, playerNumber: number): GameAction {
    return // action
  }
}

const bot = new PlayfulBot<WallRaceGameState>(token, new MyAI());

bot.run().catch((reason) => {
  console.error(reason);
  process.exit(1);
})
```
