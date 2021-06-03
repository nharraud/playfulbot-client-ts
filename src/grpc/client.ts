import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';
import type { ProtoGrpcType } from './types/playfulbot_v0';
import type { PlayfulBotClient } from './types/playfulbot/v0/PlayfulBot';

const PROTO_PATH = path.join(__dirname, 'proto', 'playfulbot', 'v0', 'playfulbot_v0.proto');


const packageDefinition = protoLoader.loadSync(PROTO_PATH);
export const proto = (grpc.loadPackageDefinition(
  packageDefinition
) as unknown) as ProtoGrpcType;


export function createClient(url: string, options: { timeout: number } = { timeout: 5000 }): Promise<PlayfulBotClient> {
  // Note that we could add the token to call credentials with "createFromMetadataGenerator". However
  // for some reason it slows down requests a lot. Adding the token to each request metadata doesn't
  // have this slowing effect.
  const channelCreds = grpc.credentials.createSsl();
  return new Promise((resolve, reject) => {
    const client = new proto.playfulbot.v0.PlayfulBot(
      url,
      channelCreds
    );
    
    const deadline = new Date();
    deadline.setMilliseconds(deadline.getMilliseconds() + options.timeout);
    client.waitForReady(deadline, (error?: Error) => {
      if (error) {
        reject(error);
      } else {
        console.log('Connected to server.');
        resolve(client);
      }
    });
  });
}
