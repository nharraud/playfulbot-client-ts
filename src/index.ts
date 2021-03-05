import { run_player1 } from './player1';
import { run_player2 } from './player2';

run_player1().catch((reason) => {
  console.log(reason);
});
run_player2().catch((reason) => {
  console.log(reason);
});
