declare const __APP_COMMIT__: string;
declare const __API_CONTRACT__: string;

/** The commit this build came from. */
export const APP_COMMIT = __APP_COMMIT__;
/** A hash of api/openapi.yaml: changes only when the API's shapes do. */
export const API_CONTRACT = __API_CONTRACT__;
