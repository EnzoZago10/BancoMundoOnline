import fs from "node:fs/promises";
import path from "node:path";
import { pool } from "./database.js";
if (!pool) throw Error("DATABASE_URL não configurada.");
const client=await pool.connect();
try{
  await client.query(`create table if not exists public.schema_migrations (name text primary key, applied_at timestamptz not null default now())`);
  const dir=path.resolve(process.cwd(),"migrations");
  const files=(await fs.readdir(dir)).filter(x=>x.endsWith(".sql")).sort();
  for(const name of files){const exists=await client.query(`select 1 from public.schema_migrations where name=$1`,[name]);if(exists.rowCount){console.log("Já aplicada",name);continue;}const sql=await fs.readFile(path.join(dir,name),"utf8");console.log("Aplicando",name);await client.query("BEGIN");try{await client.query(sql);await client.query(`insert into public.schema_migrations(name) values($1)`,[name]);await client.query("COMMIT");}catch(e){await client.query("ROLLBACK");throw e;}}
}finally{client.release();await pool.end();}
console.log("Migrações concluídas.");
