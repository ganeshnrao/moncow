import { connect } from "./runner";

export default async function(code: string) {
  const fn = new Function("require", "connect", code);
  const environments: string[] = [];
  const result = await fn(require, (env: string, dbNames: string[]) => {
    environments.push(env);
    return connect(
      env,
      dbNames
    );
  });
  return { result, environments };
}
