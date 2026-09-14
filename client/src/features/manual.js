import { escapeHtml as esc } from "../ui/safe.js";
const topics=[
["Criar e entrar","Crie uma sala com nome e PIN. O Modo Assistido usa o tabuleiro físico; o Modo Completo permanece indisponível até existirem dados oficiais do tabuleiro e das cartas."],
["Regras da partida","Antes de criar, escolha regras oficiais ou personalizadas. O servidor guarda e aplica o ruleset; regras da casa ficam identificadas para todos."],
["Códigos","O código temporário identifica a sala ativa. O permanente restaura a partida. O código pessoal recupera somente o seu perfil em outro aparelho."],
["ADM","O ADM aprova banco, patrimônio e ferramentas administrativas, pode transferir a administração e registrar ajustes de uma partida física existente."],
["Dinheiro e liquidez","Pagamentos sem saldo não deixam o saldo negativo: criam uma obrigação e abrem a Central de Liquidez."],
["Propriedades e construções","Uma compra nasce sem construção. Casas e condomínio usam o motor da sala, o estoque e as regras de grupo/uniformidade configuradas."],
["Negociações","Trades são bilaterais: cada lado informa dinheiro e patrimônios; somente o destinatário aceita e o servidor revalida tudo atomicamente."],
["Hipoteca","Hipotecar recebe o valor oficial; resgatar paga o valor mais juros do ruleset. Não é permitido construir em patrimônio hipotecado."],
["Cadeia","O rastreador assistido registra prisão, visita, tentativas, fiança e Habeas Corpus. Presos recebem aluguel, mas não negociam."],
["FMI","A fórmula dados × 2.000 é regra legada do aplicativo e NÃO está confirmada pelo manual fornecido. Para regra oficial, siga a instrução impressa no tabuleiro físico."],
["Falência","Antes da falência use liquidez: vender construções, hipotecar e negociar/vender. A falência registra o credor, devolve peças e pode ser desfeita pelo ADM apenas se o snapshot ainda for consistente."],
["Segurança","PIN e recovery token têm finalidades diferentes. Não compartilhe o código pessoal publicamente."],
];
export function renderManual($){const term=$("#manualSearch")?.value.trim().toLocaleLowerCase("pt-BR")||"",items=topics.filter(([a,b])=>!term||`${a} ${b}`.toLocaleLowerCase("pt-BR").includes(term)),box=$("#manualContent");if(!box)return;box.innerHTML=items.length?items.map(([title,text],i)=>`<details class="manual-topic" ${term||i===0?"open":""}><summary>${esc(title)}</summary><p>${esc(text)}</p></details>`).join(""):'<div class="empty">Nenhum assunto encontrado.</div>';}
export function bindManual($){renderManual($);$("#manualSearch")?.addEventListener("input",()=>renderManual($));}
