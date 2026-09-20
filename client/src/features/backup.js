export function downloadJson(content,filename="Banco-Mundo-0.9.3.json"){
  const text=typeof content==="string"?content:JSON.stringify(content,null,2),url=URL.createObjectURL(new Blob([text],{type:"application/json"})),a=document.createElement("a");
  a.href=url;a.download=filename;a.style.display="none";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}

export async function importBackup({apiBase,file,pin="",toast,onImported}){
  if(!file){toast("Selecione um backup JSON.","warning");return null;}
  try{
    const raw=JSON.parse(await file.text()),headers={"Content-Type":"application/json"};
    const response=await fetch(`${apiBase}/api/import`,{method:"POST",headers,body:JSON.stringify({backup:raw,pin})}),data=await response.json();
    if(!response.ok)throw Error(data.error||"Falha ao importar backup.");
    onImported?.(data);toast(`Backup restaurado com código ${data.saveCode}.`,"success");return data;
  }catch(error){toast(error.message||"Falha ao importar backup.","error");return null;}
}

export function renderImportedBackup({result,data,onChooseProfile}){
  if(!result||!data)return;result.classList.remove("hidden");result.replaceChildren();
  const strong=document.createElement("strong");strong.textContent="Backup restaurado com sucesso.";result.append(strong);
  const codeLine=document.createElement("div");codeLine.textContent=`Código da nova partida: ${data.saveCode}`;result.append(codeLine);
  const profiles=Array.isArray(data.recoveryProfiles)?data.recoveryProfiles:[];
  if(!profiles.length)return;
  const warning=document.createElement("div");warning.className="small";warning.textContent="Escolha seu perfil para continuar. Novos códigos de recuperação foram gerados; guarde e envie o código correto para cada amigo.";result.append(warning);
  const list=document.createElement("div");list.className="restore-profile-list";
  for(const profile of profiles){
    const row=document.createElement("div");row.className="restore-profile";
    const identity=document.createElement("div"),name=document.createElement("strong"),token=document.createElement("code");name.textContent=profile.name;token.textContent=profile.recoveryToken;identity.append(name,token);
    const actions=document.createElement("div");actions.className="row";
    const copy=document.createElement("button");copy.type="button";copy.textContent="Copiar código";copy.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(profile.recoveryToken);}catch{};});actions.append(copy);
    if(onChooseProfile){const enter=document.createElement("button");enter.type="button";enter.className="primary";enter.textContent=`Entrar como ${profile.name}`;enter.addEventListener("click",()=>onChooseProfile(profile,data));actions.append(enter);}
    row.append(identity,actions);list.append(row);
  }
  result.append(list);
}
