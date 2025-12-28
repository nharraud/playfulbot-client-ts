import * as fs from 'fs';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';
import type { ProtoGrpcType as BackendProtoGrpcType } from './types/playfulbot_backend_v0';
import type { ProtoGrpcType as RunnerProtoGrpcType } from './types/playfulbot_runner_v0';

const BACKEND_PROTO_PATH = path.join(__dirname, 'proto', 'playfulbot_backend', 'v0', 'playfulbot_backend_v0.proto');
const backendPackageDefinition = protoLoader.loadSync(BACKEND_PROTO_PATH);
export const backendProto = (grpc.loadPackageDefinition(
  backendPackageDefinition
) as unknown) as BackendProtoGrpcType;

const RUNNER_PROTO_PATH = path.join(__dirname, 'proto', 'playfulbot_runner', 'v0', 'playfulbot_runner_v0.proto');
const runnerPackageDefinition = protoLoader.loadSync(RUNNER_PROTO_PATH);
export const runnerProto = (grpc.loadPackageDefinition(
  runnerPackageDefinition
) as unknown) as RunnerProtoGrpcType;


type Constructor = new (...args: any) => any;

function clientFactory<ProtoType extends Constructor>(Proto: ProtoType) {
  return function createClient(url: string, options: { timeout: number } = { timeout: 5000 }): Promise<InstanceType<ProtoType>> {
    console.log(`Playfulbot client in creation for url ${url}`);
    // Note that we could add the token to call credentials with "createFromMetadataGenerator". However
    // for some reason it slows down requests a lot. Adding the token to each request metadata doesn't
    // have this slowing effect.
    let rootcert;
    if (process.env.SSL_CA) {
      rootcert = fs.readFileSync(process.env.SSL_CA);
    }
    const channelCreds = grpc.credentials.createSsl(rootcert);

    return new Promise((resolve, reject) => {
      const client = new Proto(
        url,
        channelCreds
      );
      console.log('Playfulbot client created');
      
      const deadline = new Date();
      deadline.setMilliseconds(deadline.getMilliseconds() + options.timeout);
      client.waitForReady(deadline, (error?: Error) => {
        if (error) {
          console.log('Playfulbot client creation failed', error);
          reject(error);
        } else {
          console.log('Connected to server.');
          resolve(client);
        }
      });
    });
  }
}

export const createBackendClient = clientFactory(backendProto.playfulbot_backend.v0.PlayfulBot);
export const createRunnerClient = clientFactory(runnerProto.playfulbot_runner.v0.PlayfulBotGameRunner);
