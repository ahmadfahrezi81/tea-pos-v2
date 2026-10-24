declare const __APP_COMMIT__: string;
declare const __APP_VERSION__: string;
declare const __API_CONTRACT__: string;

/** The release this build belongs to ("2026.10.3"), or "staging", "preview", "dev". */
export const APP_VERSION = __APP_VERSION__;
/** The commit this build came from. */
export const APP_COMMIT = __APP_COMMIT__;
/** A hash of api/openapi.yaml: changes only when the API's shapes do. */
export const API_CONTRACT = __API_CONTRACT__;
