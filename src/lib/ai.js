import { supabase } from './supabase'
import { parseObsList, obsListToText } from './obs'

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`

/**
 * Chama a Edge Function ai-chat com autenticação Supabase.
 * messages: array de { role, content }
 * system: string com o system prompt
 */
export async function callAI({ messages, system, max_tokens = 1200 }) {
  // supabase.auth.getSession() pode travar pra sempre em alguns navegadores
  // mobile (lock interno do supabase-js) — nunca deixamos isso prender a
  // chamada à IA; se não resolver rápido, seguimos sem o token do usuário.
  let token
  try {
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ])
    token = result?.data?.session?.access_token
  } catch {
    token = undefined
  }

  const res = await fetch(EDGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ messages, system, max_tokens }),
  })

  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data.content?.[0]?.text ?? ''
}

/**
 * Gera cronograma a partir de uma descrição em texto livre.
 * Retorna array de atividades.
 */
export async function gerarCronograma({ descricao, semanas = 20 }) {
  const text = await callAI({
    system: `Você é um engenheiro sênior de planejamento de obras civis.
A obra tem duração total de ${semanas} semanas.

Analise a descrição fornecida e gere um cronograma completo em JSON puro (sem markdown, sem explicação, apenas o array JSON).
Interprete os serviços, estime durações realistas em semanas, crie sequências lógicas de dependência.

Formato de resposta — array JSON:
[
  {
    "nome": "Nome da atividade",
    "grupo": "NOME DO GRUPO / ETAPA",
    "sIni": 1,
    "sFim": 3,
    "tipo": "exec",
    "pct": 0
  }
]

Regras:
- tipo permitido apenas: exec | concr | usinado | cura | magro
- sIni e sFim devem ser números inteiros entre 1 e ${semanas}
- Agrupe atividades em etapas lógicas (ex: SERVIÇOS PRELIMINARES, FUNDAÇÕES, ESTRUTURA, etc.)
- Distribua as atividades ao longo de toda a duração da obra
- Atividades que dependem de outras começam após a predecessora
- Seja detalhado: mínimo 8 atividades, até 30 para projetos complexos
- Responda APENAS com o JSON, sem texto antes ou depois`,
    messages: [{ role: 'user', content: descricao }],
    max_tokens: 3000,
  })

  try {
    // Remove markdown code blocks if present
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(clean)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    // Try to find JSON array in the response
    const match = text.match(/\[[\s\S]*\]/)
    if (match) {
      try { return JSON.parse(match[0]) } catch {}
    }
    return []
  }
}

/**
 * Analisa o RDO e retorna texto com análise + lista de atualizações.
 */
export async function analisarRdo({ obra, atividades, semanaAtual, mensagem, historico, materiais = [] }) {
  // Build activity context with all available data
  const atividadesCtx = atividades.map(a => {
    const workers   = (a.workers   || []).length > 0 ? ` | Profissionais: ${(a.workers || []).map(w => `${w.qty}x ${w.role}`).join(', ')}` : ''
    const equipment = (a.equipment || []).length > 0 ? ` | Equipamentos: ${(a.equipment || []).map(e => typeof e === 'string' ? e : (e.qty > 1 ? `${e.qty}x ${e.name}` : e.name)).join(', ')}` : ''
    const grupo     = a.group_name ? ` [${a.group_name}]` : ''
    const obsArr    = parseObsList(a.observacoes)
    const obs       = obsArr.length ? ` | ${obsListToText(obsArr).replace(/\n/g, ' / ')}` : ''
    return `• [${a.pct ?? 0}% | ${a.status}]${grupo} ${a.name} S${a.week_start}–${a.week_end}${workers}${equipment}${obs}`
  }).join('\n')

  // Build materials context for the current week
  const matsNaSemana = materiais.filter(m => m.week === semanaAtual)
  const materiaisCtx = matsNaSemana.length > 0
    ? `\nMATERIAIS PREVISTOS PARA SEMANA ${semanaAtual}:\n` +
      matsNaSemana.map(m => `• [${m.status}] ${m.name} — ${m.quantity} ${m.unit}${m.notes ? ` (${m.notes})` : ''}`).join('\n')
    : ''

  // Active activities in the current week
  const ativasNaSemana = atividades.filter(a => a.week_start <= semanaAtual && a.week_end >= semanaAtual)
  const ativasCtx = ativasNaSemana.length > 0
    ? `\nATIVIDADES ATIVAS NA SEMANA ${semanaAtual}:\n` +
      ativasNaSemana.map(a => {
        const workers   = (a.workers   || []).length > 0 ? ` | Profissionais: ${(a.workers || []).map(w => `${w.qty}x ${w.role}`).join(', ')}` : ' | Profissionais: não definidos'
        const equipment = (a.equipment || []).length > 0 ? ` | Equipamentos: ${(a.equipment || []).map(e => typeof e === 'string' ? e : (e.qty > 1 ? `${e.qty}x ${e.name}` : e.name)).join(', ')}` : ''
        return `• ${a.name} (${a.pct ?? 0}% | ${a.status})${workers}${equipment}`
      }).join('\n')
    : `\n(Nenhuma atividade ativa na semana ${semanaAtual})`

  const system = `Você é a IA de planejamento do Splanner — obra "${obra.nome}" · Semana ${semanaAtual}/${obra.semanas}.

TODAS AS ATIVIDADES DO CRONOGRAMA:
${atividadesCtx}
${ativasCtx}
${materiaisCtx}

INSTRUÇÕES:
- Responda de forma direta e específica com base nos dados reais acima
- Use os nomes exatos das atividades, profissionais e equipamentos listados
- Se perguntarem sobre profissionais de uma semana, liste exatamente os que estão no campo "Profissionais" das atividades ativas naquela semana
- Se nenhum profissional estiver cadastrado numa atividade, diga isso claramente e sugira que sejam cadastrados no editor de atividades
- Calcule atrasos em semanas com precisão
- Sugira ações corretivas concretas
- Seja objetivo: máximo 4 parágrafos, sem headers markdown excessivos

Se precisar atualizar atividades, liste ao final (uma por linha):
ATUALIZAR: [nome exato] → pct: X%, status: Y, week_start: Z, week_end: W`

  const msgs = [
    ...historico.slice(-8),
    { role: 'user', content: mensagem },
  ]

  return callAI({ system, messages: msgs, max_tokens: 1400 })
}

/**
 * IA do Fluxograma — lê a rede de dependências (nós + setas) e o status de
 * cada etapa e responde sobre andamento geral, gargalos e próximos passos.
 * Substitui o antigo "Diagnóstico com IA": aqui a IA raciocina em cima do
 * grafo de precedência, não de um RDO isolado.
 */
export async function analisarFluxo({ obra, atividades, mensagem, historico = [] }) {
  const byId = Object.fromEntries(atividades.map(a => [a.id, a]))

  const nodeLine = (a) => {
    const preds = (a.predecessor_ids || [])
      .map(pid => byId[pid]?.name)
      .filter(Boolean)
    const predsTxt = preds.length ? ` | depende de: ${preds.join(', ')}` : ' | sem dependências (pode começar a qualquer momento)'
    const obsArr = parseObsList(a.observacoes)
    const motivo = a.status === 'atrasado' && obsArr.length ? ` | motivo da parada: ${obsListToText(obsArr).replace(/\n/g, ' / ')}` : ''
    return `• [${a.status} | ${a.pct ?? 0}%] ${a.name}${a.group_name ? ` (${a.group_name})` : ''}${predsTxt}${motivo}`
  }

  const grafoCtx = atividades.map(nodeLine).join('\n')

  // Frentes liberadas: todas as predecessoras concluídas, e esta ainda não concluída
  const liberadas = atividades.filter(a => {
    if (a.status === 'concluido') return false
    const preds = a.predecessor_ids || []
    return preds.length === 0 || preds.every(pid => byId[pid]?.status === 'concluido')
  }).map(a => a.name)

  // Travadas: pelo menos uma predecessora não concluída
  const travadas = atividades.filter(a => {
    if (a.status === 'concluido') return false
    const preds = a.predecessor_ids || []
    return preds.length > 0 && !preds.every(pid => byId[pid]?.status === 'concluido')
  }).map(a => a.name)

  const system = `Você é a IA de planejamento do Splanner — um AGENTE ATIVO, não só um chat. Você lê o FLUXOGRAMA de execução da obra "${obra.nome}" e tem autoridade para corrigir a rede diretamente: conectar etapas que estão soltas, corrigir predecessoras erradas e ajustar prazos inconsistentes. Seu objetivo é manter a obra sempre organizada e andando — nunca deixe etapas soltas ou com datas que não fazem sentido na sequência construtiva real.

O fluxograma é um grafo de dependências: cada etapa só pode avançar depois que TODAS as suas predecessoras estiverem concluídas. Uma etapa pode liberar várias frentes em paralelo.

REDE DE ETAPAS (nome, status, % e dependências):
${grafoCtx}

FRENTES LIBERADAS AGORA (predecessoras concluídas, pode avançar):
${liberadas.length ? liberadas.map(n => `• ${n}`).join('\n') : '(nenhuma — revise o cronograma)'}

FRENTES TRAVADAS (aguardando predecessora):
${travadas.length ? travadas.map(n => `• ${n}`).join('\n') : '(nenhuma)'}

INSTRUÇÕES:
- Responda com base exclusivamente na rede acima, usando seu conhecimento real de engenharia e sequência construtiva (fundação antes de estrutura, estrutura antes de cobertura, cura antes de desforma, etc.)
- Aponte o andamento geral, gargalos (etapas que travam várias frentes) e os próximos passos concretos
- Se uma etapa estiver com status "atrasado" e motivo informado, cite o motivo e sugira ação corretiva
- Seja objetivo: máximo 4 parágrafos, sem headers markdown excessivos
- Nunca escreva literalmente um objeto JS (tipo [object Object]) — se for citar profissionais ou equipamentos, descreva em texto normal

AÇÃO NA REDE (obrigatório quando fizer sentido): depois do texto, se encontrar etapa sem predecessor correto, com predecessor errado, com prazo (semana) incompatível com a sequência, ou com nome mal escrito/genérico demais, liste as correções — uma por linha, nesse formato EXATO, usando os nomes EXATOS das etapas acima:
LIGAR: [nome exato da etapa] → depende de: [nome exato predecessora 1, nome exato predecessora 2]
DESLIGAR: [nome exato da etapa] → remove depende de: [nome exato predecessora]
PRAZO: [nome exato da etapa] → semana_inicio: N, semana_fim: M
RENOMEAR: [nome exato atual da etapa] → novo nome: [nome novo]

Regras dessas linhas de ação:
- LIGAR substitui TODAS as dependências atuais da etapa pelas listadas — se a etapa não deve ter nenhuma predecessora (é a primeira da obra), não gere linha LIGAR pra ela. Use LIGAR quando for definir a lista completa e correta de predecessoras de uma etapa (reorganização, correção de sequência, ou o usuário pedindo pra conectar/ligar uma etapa a outra(s))
- DESLIGAR: use quando o usuário pedir pra DESCONECTAR, REMOVER, BARRAR ou DESFAZER uma dependência específica entre duas etapas nomeadas (ex: "desconecta X de Y", "tira a dependência de Y em X", "X não precisa mais depender de Y") — remove só esse vínculo pontual, sem mexer nas outras dependências que a etapa já tem. Não recalcule a lista inteira pra isso, só gere a linha DESLIGAR
- Nem toda etapa precisa depender da anterior numa fila única: etapas COMPLEMENTARES/paralelas (ex: elétrico e hidráulico andando juntos depois da alvenaria) devem compartilhar a MESMA predecessora, sem depender uma da outra — isso faz elas aparecerem lado a lado no mesmo nível do fluxo, formando frentes paralelas de verdade, não uma fila única
- RENOMEAR: se o usuário PEDIU EXPLICITAMENTE pra renomear/mudar o nome de uma etapa (ex: "renomeia X pra Y", "troca o nome de X pra Y", "muda o nome da etapa X", "chama isso de Y"), SEMPRE gere a linha RENOMEAR com o nome exato pedido por ele — mesmo que o nome atual não pareça "errado". Fora desse caso (você decidindo sozinho, ex: ao reorganizar o fluxograma inteiro), só sugira RENOMEAR quando o nome atual estiver claramente errado, truncado, duplicado ou genérico demais — nunca renomeie por preferência de estilo quando ninguém pediu
- Só gere LIGAR/DESLIGAR/PRAZO/RENOMEAR quando houver uma correção real a fazer OU quando o usuário pediu explicitamente aquela mudança. Se o usuário pedir explicitamente para reorganizar tudo, gere LIGAR e PRAZO para todas as etapas (mesmo as que já estão corretas, para confirmar), identificando corretamente quais são sequenciais e quais são paralelas/complementares
- Se o usuário pedir uma alteração específica (renomear, mudar prazo, ligar/desligar dependência) e você gerar a linha de ação correspondente, SEMPRE use o nome EXATO da etapa como aparece em "REDE DE ETAPAS" acima — nunca abrevie, corrija acentuação ou reescreva o nome, ou a ação não vai ser reconhecida pelo sistema
- Nunca invente etapas que não estão na lista acima`

  const msgs = [
    ...historico.slice(-8),
    { role: 'user', content: mensagem },
  ]

  return callAI({ system, messages: msgs, max_tokens: 3000 })
}
