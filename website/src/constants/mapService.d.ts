export declare const REMOTE_MAP_SERVICE_URL: string;
export declare const MAP_SERVICE_BASE_URL: string;

export declare function fetchFromMapService(
  resourcePath: string,
  init?: RequestInit,
): Promise<Response>;

export declare function resolveMapServiceBaseUrl(): Promise<string>;
