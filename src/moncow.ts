import * as vscode from "vscode";
import { mapSeries } from "bluebird";
import { MongoClient } from "mongodb";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";

interface Configs {
  startPortFrom: number;
  connections: {
    environment: string;
    connectionConfigs: {
      url: string;
      tunnel: boolean;
      dbNames: string[];
    }[];
  }[];
}

interface DatabaseInfo {
  dbName: string;
  environment: string;
  url: string;
  tunnel?: boolean;
  port?: number;
}

interface ClientInfo extends DatabaseInfo {
  mongoClient?: MongoClient;
  childProcess?: ChildProcessWithoutNullStreams;
  childProcessIsAlive?: boolean;
}

type Environment = Map<string, DatabaseInfo>;
type ConnectionSettings = Map<string, Environment>;

let connectionSettings: ConnectionSettings = new Map();
const clients: Map<string, ClientInfo> = new Map();
const baseMongoUrl: string = "mongodb://localhost";
const baseTunnelUrl: string = "localhost:27017";
const mongoConfig: object = { useNewUrlParser: true, useUnifiedTopology: true };
const killSignal: string = "SIGHUP";

export function updateSettings(): void {
  const configs: Configs | undefined = vscode.workspace.getConfiguration().get("moncow");
  if (!configs) {
    return;
  }
  const { startPortFrom = 27020, connections = [] } = configs;
  let port: number = startPortFrom;
  connectionSettings = connections.reduce((acc, { environment, connectionConfigs }) => {
    const dbSettings: Map<string, DatabaseInfo> = new Map();
    connectionConfigs.forEach(({ url, tunnel, dbNames }) => {
      dbNames.forEach(dbName => {
        const dbInfo: DatabaseInfo = { dbName, environment, url };
        if (tunnel) {
          dbInfo.tunnel = tunnel;
          dbInfo.port = port;
          port += 1;
        }
        dbSettings.set(dbName, dbInfo);
      });
    });
    acc.set(environment, dbSettings);
    return acc;
  }, new Map());
}

async function disconnectOne(clientInfo: ClientInfo): Promise<string> {
  const { url, mongoClient, childProcess, childProcessIsAlive } = clientInfo;
  try {
    if (mongoClient) {
      await mongoClient.close();
    }
    if (childProcess && childProcessIsAlive) {
      childProcess.kill(killSignal);
    }
    clients.delete(url);
    return `${url} (OK)`;
  } catch (error) {
    // TODO: clean up when disconnection fails
    return `${url} (Failed. ${error.message})`;
  }
}

export async function disconnectAll(): Promise<string[]> {
  const clientsToDisconnect: ClientInfo[] = Array.from(clients.values());
  const result: string[] = await mapSeries(clientsToDisconnect, disconnectOne);
  return result;
}

function attachTunnel(clientInfo: ClientInfo): void {
  const { url, port } = clientInfo;
  const commandArgs: string[] = ["-L", `${port}:${baseTunnelUrl}`, "-N", url];
  const childProcess: ChildProcessWithoutNullStreams = spawn("ssh", commandArgs);
  clientInfo.childProcess = childProcess;
  clientInfo.childProcessIsAlive = true;
  childProcess
    .on("exit", () => {
      clientInfo.childProcessIsAlive = false;
    })
    .once("error", () => disconnectOne(clientInfo));
}

function getMongoUrl(clientInfo: ClientInfo): string {
  const { url, port, tunnel } = clientInfo;
  if (tunnel) {
    return `${baseMongoUrl}:${port}`;
  }
  return url;
}

async function createClient(dbInfo: DatabaseInfo): Promise<ClientInfo> {
  const { url, tunnel } = dbInfo;
  const clientInfo: ClientInfo = { ...dbInfo };
  if (tunnel) {
    attachTunnel(clientInfo);
  }
  clientInfo.mongoClient = await MongoClient.connect(getMongoUrl(clientInfo), mongoConfig);
  clients.set(url, clientInfo);
  return clientInfo;
}

export async function connectOne(environment: string, dbNames: string[]): Promise<object> {
  const envSetting: Environment | undefined = connectionSettings.get(environment);
  if (!envSetting) {
    throw new Error(
      `Attempting to connect to environment "${environment}" which is not defined in "moncow.connections".`
    );
  }
  const dbInfos: DatabaseInfo[] = [];
  const allowedDbNames = Array.from(envSetting.keys())
    .map(dbName => `"${dbName}"`)
    .join(", ");
  dbNames.forEach(dbName => {
    const dbInfo: DatabaseInfo | undefined = envSetting.get(dbName);
    if (dbInfo) {
      dbInfos.push(dbInfo);
    } else {
      throw new Error(
        `Attempting to connect to database "${dbName}" which is not defined in "moncow.connections". Allowed databases for environment "${environment}" are ${allowedDbNames}.`
      );
    }
  });
  if (dbInfos.length === 0) {
    throw new Error(
      `None of the provided database names are defined in "moncow.connections". Allowed databases for environment "${environment}" are ${allowedDbNames}`
    );
  }
  const result: any = {};
  await mapSeries(dbInfos, async dbInfo => {
    const { url, dbName } = dbInfo;
    if (!clients.has(url)) {
      await createClient(dbInfo);
    }
    const client: ClientInfo | undefined = clients.get(url);
    if (client && client.mongoClient) {
      result[dbName] = client.mongoClient.db(dbName);
    }
  });
  return result;
}

export async function run(code: string): Promise<{ result: any; environments: string[] }> {
  const innerModule: { exports?: Function } = {};
  const fn: Function = new Function("require", "connect", "module", code);
  const environments: string[] = [];
  fn(
    require,
    (environment: string, dbNames: string[]) => {
      environments.push(environment);
      return connectOne(environment, dbNames);
    },
    innerModule
  );
  const result: any =
    innerModule.exports && typeof innerModule.exports === "function"
      ? await innerModule.exports()
      : { message: "You did not export an async function" };
  return { result, environments };
}

export async function initialize() {
  await disconnectAll();
  updateSettings();
}

export function showConnected(): any {
  const result: any = {};
  clients.forEach(({ environment, dbName, url, tunnel, port, childProcessIsAlive }) => {
    const env = result[environment] || [];
    env.push({ dbName, url, tunnel, port, childProcessIsAlive });
    result[environment] = env;
  });
  return result;
}
