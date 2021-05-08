import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';


import { ClientInterfaces, ProtoGrpcType, ServiceHandlers } from './proto/types/playfulbot_v0';
import { verify } from 'jsonwebtoken';
import { resolve } from 'path';
import { FollowGameResponse, FollowGameResponse__Output } from './proto/types/playfulbot/v0/FollowGameResponse';
import { FollowGameRequest } from './proto/types/playfulbot/v0/FollowGameRequest';

const PROTO_PATH = path.join(__dirname, 'proto', 'playfulbot', 'v0', 'playfulbot_v0.proto');


const packageDefinition = protoLoader.loadSync(PROTO_PATH);
const proto = (grpc.loadPackageDefinition(
  packageDefinition
) as unknown) as ProtoGrpcType;


export function createClient(url: string): Promise<ClientInterfaces.playfulbot.v0.PlayfulBotClient> {
  // Note that we could add the token to call credentials with "createFromMetadataGenerator". However
  // for some reason it slows down requests a lot. Adding the token to each request metadata doesn't
  // have this slowing effect.
  const channelCreds = grpc.credentials.createSsl();
  return new Promise((resolve, reject) => {
    const client = new proto.playfulbot.v0.PlayfulBot(
      url,
      channelCreds, {
        // 'grpc.max_concurrent_streams': 50,
        // 'grpc.keepalive_time_ms': 1000,
        // 'grpc.keepalive_timeout_ms': 2000,
        // 'grpc.keepalive_permit_without_calls': 1,
        // 'grpc.http2.max_pings_without_data': 0,
      }
    );
    
    const deadline = new Date();
    deadline.setSeconds(deadline.getSeconds() + 5);
    client.waitForReady(deadline, (error?: Error) => {
      if (error) {
        reject(`Client connect error: ${error.message}`);
      } else {
        resolve(client);
      }
    });
  });
}
