import * as _ from "lodash";
import { mapSeries } from "bluebird";
import { MongoClient, Db } from "mongodb";
import { spawn } from "child_process";
import { databases } from "./config";

const { logRow } = require("log-row");

const rowSetting = logRow({
  columns: [
    { key: "method", label: null, width: 20, align: "left" },
    { key: "env", label: "Env", width: 8, align: "left" },
    { key: "dbName", label: "DB", width: 27, align: "left" },
    { key: "url", label: "URL", width: 32, align: "left" },
    { key: "mongoUrl", label: "Mongo", width: 32, align: "left" },
    { key: "tunnel", label: "Tunnel", width: 1, align: "left", truncate: true },
    { key: "cached", label: "Cached", width: 1, align: "left", truncate: true },
    { key: "code", label: "Code" },
    { key: "signal", label: "Signal" },
    { key: "message", label: "Message" }
  ]
});

const row = (...args: any) =>
  console.log("{ MonCow } Runner", rowSetting(...args));

const clients = new Map();
const mongoConfig = { useNewUrlParser: true, useUnifiedTopology: true };

async function cleanUp(setting: any) {
  const { url, childAlive } = setting;
  if (clients.has(url)) {
    const { client, tunnelChild } = clients.get(url);
    await client.close();
    if (tunnelChild && childAlive) {
      tunnelChild.kill("SIGHUP");
    }
    clients.delete(url);
    return url;
  }
}

function createTunnel(setting: any) {
  const method = "createTunnel";
  const { url, port } = setting;
  row({ method, ...setting });
  const tunnelChild = spawn("ssh", [
    "-L",
    `${port}:localhost:27017`,
    "-N",
    url
  ]);
  setting.childAlive = true;
  tunnelChild.stderr.on("data", message =>
    row({ method, ...setting, message })
  );
  tunnelChild.on("exit", () => {
    setting.childAlive = false;
  });
  tunnelChild.on("close", async (code, signal) => {
    try {
      row({ method, ...setting, code, signal });
      await cleanUp(setting);
    } catch (error) {
      row({ method, ...setting, message: error.stack });
    }
  });
  return tunnelChild;
}

async function getMongoClient(setting: any) {
  const { url, tunnel, port } = setting;
  if (clients.has(url)) {
    return clients.get(url).client;
  }
  if (!tunnel) {
    const client = await MongoClient.connect(url, mongoConfig);
    clients.set(url, { client });
    return client;
  }
  const tunnelChild = createTunnel(setting);
  const mongoUrl = `mongodb://localhost:${port}`;
  const client = await MongoClient.connect(mongoUrl, mongoConfig);
  clients.set(url, { client, tunnelChild, port });
  return client;
}

async function loadDb(env: string, dbName: string): Promise<Db> {
  const setting = _.get(databases, [env, dbName]);
  if (!setting) {
    throw new Error(`No settings for dbName ${env}.${dbName}`);
  }
  const client = await getMongoClient(setting);
  return client.db(dbName);
}

export async function connect(env: string, dbNames: string[]): Promise<any> {
  const setting = databases[env];
  if (!setting) {
    throw new Error(`No settings for "${env}"`);
  }
  const result: any = {};
  await mapSeries(dbNames, async (dbName: string) => {
    result[dbName] = await loadDb(env, dbName);
  });
  return result;
}

export async function disconnect(env: string): Promise<string[]> {
  const disconnected = await mapSeries(_.toArray(databases[env]), cleanUp);
  return _(disconnected)
    .compact()
    .uniq()
    .value();
}
