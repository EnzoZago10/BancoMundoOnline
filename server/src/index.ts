import http from "node:http";
import fs from "node:fs";
import express from "express";
import cors from "cors";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { BankRoom } from "./room.js";
import { getSavePath, importSave } from "./persistence.js";
import {
  databaseEnabled,
  testDatabaseConnection,
} from "./database.js";
await testDatabaseConnection();
const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.get("/api/health", (_q, r) => {
  r.set("Cache-Control", "no-store");
  r.json({
    ok: true,
    service: "Banco Mundo Online",
    version: "0.6.2",
    database: databaseEnabled ? "connected" : "local-fallback",
  });
});
app.get("/api/saves", (_q, r) => {
  r.status(410).json({
    error: "A listagem pública de partidas foi desativada.",
  });
});
app.get("/api/saves/:code", (q, r) => {
  try {
    r.download(getSavePath(q.params.code), `BancoMundo-${q.params.code}.json`);
  } catch (e) {
    r.status(404).json({ error: String(e) });
  }
});
app.post("/api/import", async (q, r) => {
  try {
    r.json({ saveCode: await importSave(q.body) });
  } catch (e) {
    r.status(400).json({ error: String(e) });
  }
});
const s = http.createServer(app),
  g = new Server({
    transport: new WebSocketTransport({ server: s }),
  });

g.define("bank_room", BankRoom).filterBy(["resumeCode"]);

const port = Number(process.env.PORT || 2567);

await g.listen(port);

console.log(`Banco Mundo Online 0.6.2 Redesign executando na porta ${port}`);
