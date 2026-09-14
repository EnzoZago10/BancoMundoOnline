import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
async function walk(dir){const out=[];for(const entry of await readdir(dir,{withFileTypes:true})){const p=join(dir,entry.name);if(entry.isDirectory())out.push(...await walk(p));else if(/\.(m?js)$/.test(entry.name))out.push(p);}return out;}
const files=[...await walk("client/src"),...await walk("client/public")];for(const file of files){const r=spawnSync(process.execPath,["--check",file],{stdio:"inherit"});if(r.status!==0)process.exit(r.status||1);}console.log(`Client syntax: ${files.length} arquivos OK.`);
