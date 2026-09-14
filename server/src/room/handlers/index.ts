import type { Room } from "@colyseus/core";
import type { RoomRuntime } from "../runtime.js";
import { financialHandlers } from "./financial.js";
import { tradeHandlers } from "./trade.js";
import { adminHandlers } from "./admin.js";
export function createHandlers(rt:RoomRuntime,room:Room<any>){return {...financialHandlers(rt,room),...tradeHandlers(rt),...adminHandlers(rt,room)};}
