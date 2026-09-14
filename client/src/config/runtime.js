const localHost = location.hostname === "localhost" || location.hostname === "127.0.0.1";
const localApi = `${location.protocol}//${location.hostname}:2567`;
const localWs = `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:2567`;

export const apiBase = String(import.meta.env.VITE_API_URL || (localHost ? localApi : location.origin)).replace(/\/$/, "");
export const wsBase = String(import.meta.env.VITE_WS_URL || (localHost ? localWs : `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`)).replace(/\/$/, "");
export const isLocal = localHost;
