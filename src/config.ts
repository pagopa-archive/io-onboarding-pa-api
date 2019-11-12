import { getRequiredEnvVar } from "./utils/environment";

// Endpoint to retrieve the public administrations from IPA
export const INDICEPA_URL = getRequiredEnvVar("INDICEPA_ADMINISTRATIONS_URL");
