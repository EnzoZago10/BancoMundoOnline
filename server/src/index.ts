import http from "node:http";
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { BankRoom } from "./room.js";
import { exportBackup, importSave } from "./persistence.js";
import { databaseEnabled, recordSharedRateLimit, testDatabaseConnection } from "./database.js";
import { catalog } from "./domain/catalog.js";
import { APP_VERSION, PROTOCOL_VERSION, SAVE_FORMAT_VERSION } from "./version.js";

await testDatabaseConnection();
const app = express();
const allowedOrigins=(process.env.CORS_ORIGINS||"http://localhost:5173,http://127.0.0.1:5173").split(",").map((x:string)=>x.trim()).filter(Boolean);
app.disable("x-powered-by");
app.use(cors({ origin(origin,cb){ if(!origin||allowedOrigins.includes(origin)) return cb(null,true); cb(new Error("Origem não permitida.")); } }));
app.use(express.json({ limit:"2mb", strict:true }));

const buckets=new Map<string,{at:number,count:number}>();
app.use((req:Request,res:Response,next:NextFunction)=>{ const key=req.ip||"unknown", now=Date.now(), item=buckets.get(key); if(!item||now-item.at>60_000) buckets.set(key,{at:now,count:1}); else if(++item.count>180) return res.status(429).json({error:"Muitas requisições."}); next(); });

app.get("/api/health", (_q,r)=>{ r.set("Cache-Control","no-store"); r.json({ok:true,service:"Banco Mundo Online",version:APP_VERSION,saveFormatVersion:SAVE_FORMAT_VERSION,protocolVersion:PROTOCOL_VERSION,database:databaseEnabled?"connected":"local-fallback"}); });
app.get("/api/catalog", (_q,r)=>{ r.set("Cache-Control","public, max-age=300"); r.json(catalog); });
app.get("/api/saves", (_q,r)=>r.status(410).json({error:"A listagem pública de partidas foi desativada."}));
app.get("/api/saves/:code", (_q,r)=>r.status(405).json({error:"Use POST /api/saves/:code/export com o PIN da sala."}));
const sensitiveLimit=(scope:string,limit:number,windowMs:number)=>(async(req:Request,res:Response,next:NextFunction)=>{if(!databaseEnabled)return next();try{const subject=scope==="export"?String(req.params.code||""):"global",blocked=await recordSharedRateLimit(`${scope}:${subject}:${req.ip||"unknown"}`,limit,windowMs);if(blocked)return res.status(429).json({error:"Muitas tentativas nesta operação. Tente novamente mais tarde."});next();}catch(error){console.error("Rate limit distribuído indisponível:",error instanceof Error?error.message:"erro");res.status(503).json({error:"Proteção de segurança temporariamente indisponível."});}});
app.post("/api/saves/:code/export", sensitiveLimit("export",20,15*60_000), async(q,r)=>{ try { const pin=String(q.header("x-room-pin")||""); const code=String(q.params.code||""); const backup=await exportBackup(code,pin); r.setHeader("Content-Disposition",`attachment; filename=BancoMundo-${code}-v${APP_VERSION}.json`); r.json(backup); } catch { r.status(403).json({error:"Backup não autorizado ou inexistente."}); } });
app.post("/api/import", sensitiveLimit("import",10,60*60_000), async(q,r)=>{ try{const pin=String(q.header("x-room-pin")||""); r.json(await importSave(q.body,pin));}catch(e){r.status(400).json({error:e instanceof Error?e.message:"Backup inválido."});} });
app.use((err:any,_req:any,res:any,_next:any)=>{ console.error("Erro HTTP:",err?.message||"erro"); res.status(400).json({error:"Requisição inválida."}); });

const s=http.createServer(app); const g=new Server({transport:new WebSocketTransport({server:s})});
g.define("bank_room",BankRoom).filterBy(["resumeCode"]);
const port=Number(process.env.PORT||2567); await g.listen(port);
console.log(`Banco Mundo Online ${APP_VERSION} — Simple & Fast UX executando na porta ${port}`);
