import { getRequiredEnvVar } from "./utils/environment";

// Endpoint to retrieve the public administrations from IPA
export const INDICEPA_URL = getRequiredEnvVar("INDICEPA_ADMINISTRATIONS_URL");
export const ADMINISTRATION_SEARCH_RESULTS_LIMIT =
  Number(process.env.ADMINISTRATION_SEARCH_RESULTS_LIMIT) || 30;
