import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';


import { ClientInterfaces, ProtoGrpcType, ServiceHandlers } from './proto/types/playfulbot_v0';
import { FollowGameScheduleRequest } from './proto/types/playfulbot/v0/FollowGameScheduleRequest';
import { FollowGameScheduleResponse } from './proto/types/playfulbot/v0/FollowGameScheduleResponse';
import { CreateNewDebugGameForUserResponse } from './proto/types/playfulbot/v0/CreateNewDebugGameForUserResponse';
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
  return new Promise((resolve, reject) => {
    const client = new proto.playfulbot.v0.PlayfulBot(
      url,
      grpc.credentials.createInsecure(), {
        // 'grpc.max_concurrent_streams': 50,
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
