const sleep=(ms,signal)=>new Promise((resolve,reject)=>{const timer=setTimeout(resolve,ms);signal?.addEventListener("abort",()=>{clearTimeout(timer);reject(new DOMException("Cancelado","AbortError"));},{once:true});});

export function setConnectionState($,active,title="",detail=""){
  [$("#create"),$("#join"),$("#rejoin")].forEach(button=>{if(button)button.disabled=active;});
  const box=$("#connectStatus");if(!box)return;box.classList.toggle("hidden",!active);if(title)$("#connectTitle").textContent=title;if(detail)$("#connectDetail").textContent=detail;
}
export async function wakeBackend({isLocal,apiBase,signal,$}){
  if(isLocal)return;const delays=[0,1500,2500,4000,6000,8000,10000,12000];let lastError;
  for(let index=0;index<delays.length;index+=1){if(delays[index])await sleep(delays[index],signal);setConnectionState($,true,"Acordando servidor...",`Tentativa ${index+1} de ${delays.length}. Aguarde sem tocar novamente.`);try{const response=await fetch(`${apiBase}/api/health`,{cache:"no-store",signal});if(response.ok){const health=await response.json();if(health?.ok)return;}lastError=Error(`Servidor respondeu ${response.status}.`);}catch(error){if(error?.name==="AbortError")throw error;lastError=error;}}
  throw Error(lastError?.message||"O servidor não respondeu. Tente novamente.");
}
export async function openRoomSession({Client,wsBase,apiBase,isLocal,$,create,override,collectRules,recoveryCode,signal}){
  await wakeBackend({isLocal,apiBase,signal,$});setConnectionState($,true,create?"Criando sala...":"Conectando à partida...","A conexão será feita uma única vez.");
  const client=new Client(wsBase);const data=override||{name:$("#name").value,initialBalance:2558000,mode:"assisted",rules:create?collectRules(document):undefined,pin:create?($("#protectRoomToggle")?.checked?$("#pin").value:""):$("#pin").value,deviceToken:localStorage.deviceToken||(localStorage.deviceToken=crypto.randomUUID()),recoveryCode:$("#recoveryInput").value.trim()||recoveryCode};
  if(create&&!data.operationId)data.operationId=crypto.randomUUID();let room;
  if(override?.resumeCode)room=await client.joinOrCreate("bank_room",data);else if(create)room=await client.create("bank_room",data);else{const enteredCode=(override?.roomId||$("#code").value).trim();if(!enteredCode)throw Error("Informe o código da sala ou da partida salva.");try{room=await client.joinById(enteredCode,data);}catch(activeRoomError){const authMessage=String(activeRoomError?.message||"");if(/PIN_REQUIRED|PIN incorreto|bloqueada|recuperação inválido/i.test(authMessage))throw activeRoomError;try{room=await client.joinOrCreate("bank_room",{...data,resumeCode:enteredCode});}catch(savedRoomError){throw Error(savedRoomError?.message||activeRoomError?.message||"Sala ou partida salva não encontrada.");}}}
  return{room,data,recoveryCode:data.recoveryCode||recoveryCode};
}
