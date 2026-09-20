export function bindRoomState({Callbacks,room,$,fmt,toast,sessionKey,queueRender,getMe,getIntentional,onProfileRecovered,showLiquidity,download}){
  const c=Callbacks.get(room),rerender=queueRender;
  // A primeira hidratação do Schema pode terminar depois de join/create resolver.
  // Escutar o estado inteiro garante que objetos aninhados (como GameRules)
  // também disparem uma nova renderização quando chegarem ao cliente.
  room.onStateChange(()=>rerender());
  if(room.state?.rules) c.onChange(room.state.rules,rerender);
  c.onAdd("players",p=>{c.listen(p,"balance",rerender);c.listen(p,"connected",rerender);c.onAdd(p,"assets",rerender);c.onRemove(p,"assets",rerender);rerender();});
  for(const collection of ["players","pending","debts","trades","liabilities","settlements"]){if(collection==="players")c.onRemove(collection,rerender);else{c.onAdd(collection,rerender);c.onRemove(collection,rerender);}}
  c.onAdd("events",rerender);
  for(const field of ["hostId","locked","currentPlayerId","housesRemaining","gameStarted","requiredAction","requiredActionPlayerId","winnerId","die1","die2","houseAuctionStatus","houseAuctionAvailable","houseAuctionBid","rulesSnapshot"])c.listen(room.state,field,rerender);
  room.onMessage("error",message=>{const button=$("#backup");if(button?.disabled&&button.textContent.includes("Preparando")){button.disabled=false;button.textContent="Baixar backup";}toast(message);});
  room.onMessage("action_feedback",d=>toast(d?.message||"Ação concluída.",d?.tone||"auto"));
  room.onMessage("profile_recovered",d=>{onProfileRecovered(d);toast("Perfil protegido neste aparelho.");});
  room.onMessage("room_paused",d=>toast(d.message));
  room.onMessage("liquidity_required",d=>{showLiquidity(d);toast("Você não tem saldo suficiente para este pagamento. Resolva a dívida.","warning");});
  room.onMessage("liquidity_state",showLiquidity);
  room.onMessage("physical_action_result",d=>{toast(d?.message||"Ação do tabuleiro físico registrada.");rerender();});
  room.onMessage("dice_result",d=>{if($("#digitalDiceResult"))$("#digitalDiceResult").textContent=`Dados: ${d.first??d.die1} + ${d.second??d.die2} = ${d.sum??((d.first??d.die1)+(d.second??d.die2))}${d.doubles||d.double?" • dupla":""}`;rerender();});
  room.onMessage("persistence_conflict",d=>toast(d?.message||"Conflito de persistência. A sala foi pausada para proteção.","error"));
  room.onMessage("game_finished",d=>{toast(`Partida encerrada${d?.winnerName?` • vencedor: ${d.winnerName}`:""}.`,"success");rerender();});
  room.onMessage("organization_fee_result",d=>{if($("#institutionResult"))$("#institutionResult").textContent=`Taxa oficial: ${fmt(d.amount)}${d.ownsAll?" • todas as 6 instituições: valor dobrado":""}`;});
  room.onMessage("kicked",m=>{localStorage.removeItem(sessionKey);alert(m);location.reload();});
  room.onMessage("room_ended",m=>{localStorage.removeItem(sessionKey);alert(m);location.reload();});
  room.onMessage("report",download);
  room.onMessage("backup",d=>{const content=typeof d==="string"?d:d?.content,filename=typeof d==="object"?d?.filename:undefined;if(!content)return toast("O servidor não conseguiu gerar o backup.","error");download(content,filename);const button=$("#backup");if(button){button.disabled=false;button.textContent="Baixar backup";}toast("Backup baixado com sucesso.","success");});
  room.onLeave(()=>{if(!getIntentional())toast("Conexão encerrada.");});
  rerender();
}
