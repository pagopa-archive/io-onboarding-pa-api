import { log } from "./logger";

/**
 * Checks that the environment variables with the provided name is defined,
 * if it is undefined logs an error and exits the process
 * @param varName [string] The name of the required environment variables
 */
export function getRequiredEnvVar(varName: string): string | never {
  const envVar = process.env[varName];
  if (envVar === undefined) {
    log.error("Required environment variable missing: %s", varName);
    return process.exit(1);
  }
  return envVar;
}
