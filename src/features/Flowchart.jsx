import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  useNodesState,
  useEdgesState,
  addEdge,
  ReactFlowProvider,
} from 'reactflow'
import 'reactflow/dist/style.css'

import { C, FONT_BODY, FONT_DISPLAY, STATUS_MAT } from '../tokens'
import { Btn, Badge, Icon, Modal, Input, Select, Textarea, ProgressBar, Spinner, Alert, Empty, Label } from '../components/ui'
import {
  updateActivityFields,
  createActivity,
  deleteActivity,
  fetchActivityDocs,
  uploadActivityDoc,
  getActivityDocUrl,
  deleteActivityDoc,
  upsertMaterial,
  deleteMaterial,
  updateMaterialStatus,
  fetchReports,
  linkReportToActivity,
  unlinkReportFromActivity,
} from '../lib/supabase'
import { analisarFluxo } from '../lib/ai'
import { parseObsList, stringifyObsList, obsListToText } from '../lib/obs'

const STATUS_OPTIONS = [
  { value: 'nao_iniciado', label: 'Não iniciado' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'concluido',    label: 'Concluído'    },
  { value: 'atrasado',     label: 'Atrasado / Parado' },
]
const STATUS_COLORS = {
  nao_iniciado: { bg: C.gray100,    cor: C.gray500 },
  em_andamento: { bg: C.amberLight, cor: C.amber   },
  concluido:    { bg: C.greenLight, cor: C.green   },
  atrasado:     { bg: C.redLight,   cor: C.red     },
}
const GROUP_PALETTE = ['#E8500A', '#2563EB', '#16A34A', '#D97706', '#7C3AED', '#0D9488', '#DB2777', '#4B5563']

function groupColor(name = '') {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return GROUP_PALETTE[h % GROUP_PALETTE.length]
}

// ─── Auto layout (níveis topológicos) — só para nós sem posição salva ──
// Os cards são livres: o usuário pode arrastar pra qualquer lugar. Esse
// layout só serve de ponto de partida (e é o que a IA usa pra reorganizar):
// cada nível de profundidade (distância da predecessora mais longa) vira uma
// "linha", e tarefas do mesmo nível (paralelas/complementares) ficam lado a
// lado na mesma linha, lado a lado, formando um fluxo enquadrado.
const ROW_H = 210
const COL_W = 320

function computeLevels(activities) {
  const byId = Object.fromEntries(activities.map(a => [a.id, a]))
  const level = {}
  function calcLevel(a, seen) {
    if (level[a.id] != null) return level[a.id]
    if (seen.has(a.id)) return (level[a.id] = 0)
    seen.add(a.id)
    const preds = (a.predecessor_ids || []).map(id => byId[id]).filter(Boolean)
    const lvl = preds.length ? 1 + Math.max(...preds.map(p => calcLevel(p, seen))) : 0
    level[a.id] = lvl
    return lvl
  }
  activities.forEach(a => calcLevel(a, new Set()))
  return level
}

// Posição em colunas dentro de cada nível, centralizada (fluxo "enquadrado").
function computeFramedPositions(activities) {
  const level = computeLevels(activities)
  const countPerLevel = {}
  activities.forEach(a => { const l = level[a.id] || 0; countPerLevel[l] = (countPerLevel[l] || 0) + 1 })
  const maxCount = Math.max(1, ...Object.values(countPerLevel))
  const totalWidth = maxCount * COL_W
  const idxPerLevel = {}
  const pos = {}
  activities.forEach(a => {
    const lvl = level[a.id] || 0
    const idx = idxPerLevel[lvl] || 0
    idxPerLevel[lvl] = idx + 1
    const rowWidth = (countPerLevel[lvl] || 1) * COL_W
    const offset = (totalWidth - rowWidth) / 2
    pos[a.id] = { x: offset + idx * COL_W, y: lvl * ROW_H }
  })
  return pos
}

function layout(activities) {
  const framed = computeFramedPositions(activities)
  const pos = {}
  activities.forEach(a => {
    if (a.flow_x != null && a.flow_y != null) {
      pos[a.id] = { x: Number(a.flow_x), y: Number(a.flow_y) }
      return
    }
    pos[a.id] = framed[a.id]
  })
  return pos
}

// ─── Node card ──────────────────────────────────────────────────────────────
function ActivityNode({ data }) {
  const a = data.activity
  const mats = data.materials || []
  const sc = STATUS_COLORS[a.status] || STATUS_COLORS.nao_iniciado
  const gcolor = groupColor(a.group_name || 'Geral')
  const obsList = parseObsList(a.observacoes)
  const hasObs = obsList.length > 0
  const matsUrgent = mats.some(m => m.status === 'urgente')
  const matsPendente = mats.some(m => m.status === 'pendente' || m.status === 'pedido')
  const matsAllOk = mats.length > 0 && mats.every(m => m.status === 'chegou')
  const showAlert = hasObs || mats.length > 0
  const alertColor = matsUrgent ? C.red : (hasObs || matsPendente) ? C.amber : matsAllOk ? C.green : C.gray500
  const alertBg = matsUrgent ? C.redLight : (hasObs || matsPendente) ? C.amberLight : matsAllOk ? C.greenLight : C.gray100
  const hasPredecessor = !!(a.predecessor_ids && a.predecessor_ids.length)
  const hasDependents = !!data.hasDependents
  const HANDLE_SIZE = 24
  const handleBaseStyle = {
    width: HANDLE_SIZE, height: HANDLE_SIZE, border: `2.5px solid ${C.white}`,
    left: '50%', transform: 'translateX(-50%)', zIndex: 3,
    boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
  }
  const dotOverlayStyle = (connected) => ({
    position: 'absolute', left: '50%', transform: 'translateX(-50%)',
    width: HANDLE_SIZE, height: HANDLE_SIZE, display: 'flex', alignItems: 'center', justifyContent: 'center',
    pointerEvents: 'none', color: C.white, fontWeight: 800, fontSize: 15, lineHeight: 1, zIndex: 4,
  })
  return (
    <div style={{ position: 'relative' }}>
      <div
        onClick={() => data.onOpen(a)}
        style={{
          width: 280,
          background: C.white,
          borderRadius: 12,
          border: data.highlighted ? `1.5px solid ${C.orange}` : `1.5px solid ${C.gray200}`,
          borderLeft: `6px solid ${gcolor}`,
          boxShadow: data.highlighted
            ? `0 0 0 5px ${C.orange}33, 0 2px 16px rgba(232,80,10,0.35)`
            : '0 2px 10px rgba(0,0,0,0.08)',
          padding: '14px 16px',
          fontFamily: FONT_BODY,
          cursor: 'pointer',
          transition: 'box-shadow 0.25s ease, border-color 0.25s ease',
        }}
        title="Clique para abrir os detalhes da etapa"
      >
        {a.status === 'concluido' && (
          <div style={{
            position: 'absolute', top: -11, right: 18, zIndex: 4,
            width: 22, height: 22, borderRadius: '50%', background: C.green,
            border: `2px solid ${C.white}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
          }}>
            <Icon name="check" size={12} color={C.white} />
          </div>
        )}
        <Handle
          type="target"
          position={Position.Top}
          style={{ ...handleBaseStyle, top: -HANDLE_SIZE / 2, background: hasPredecessor ? C.orange : C.gray400 }}
        />
        <div style={{ ...dotOverlayStyle(hasPredecessor), top: -HANDLE_SIZE / 2 }}>{hasPredecessor ? '−' : '+'}</div>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
          color: gcolor, marginBottom: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {a.group_name || 'Geral'}
        </div>
        <div style={{
          fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: C.black,
          lineHeight: 1.25, marginBottom: 10,
        }}>
          {a.name || '(sem nome)'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <Badge label={STATUS_OPTIONS.find(s => s.value === a.status)?.label || a.status} cor={sc.cor} bg={sc.bg} />
          {a.status === 'atrasado' && (
            <Icon name="warning" size={16} color={C.red} />
          )}
        </div>
        <ProgressBar pct={a.pct || 0} color={sc.cor === C.gray500 ? C.gray300 : sc.cor} height={6} />
        <div style={{ fontSize: 12, color: C.gray400, marginTop: 6 }}>
          S{a.week_start}–S{a.week_end} · {a.pct || 0}%
        </div>
        {showAlert && (
          <div
            title={[
              hasObs ? obsListToText(obsList) : null,
              mats.length ? `${mats.length} material(is): ${mats.map(m => `${m.name}${m.responsible_name ? ' (' + m.responsible_name + ')' : ''}`).join(', ')}` : null,
            ].filter(Boolean).join('\n')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, marginTop: 8,
              padding: '5px 8px', borderRadius: 7, background: alertBg,
            }}
          >
            <Icon name={matsAllOk && !hasObs ? 'check' : 'warning'} size={13} color={alertColor} />
            <div style={{ fontSize: 11, color: alertColor, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {hasObs ? (obsList.length > 1 ? `${obsList.length} observações: ${obsList[0]}` : obsList[0]) : matsAllOk ? `✓ Material OK: ${mats.map(m => m.name).join(', ')}` : `${mats.length} material${mats.length > 1 ? 'is' : ''}${mats.length ? ': ' + mats.map(m => m.name).join(', ') : ''}`}
            </div>
          </div>
        )}
        <Handle
          type="source"
          position={Position.Bottom}
          style={{ ...handleBaseStyle, bottom: -HANDLE_SIZE / 2, background: hasDependents ? C.orange : C.gray400 }}
        />
        <div style={{ ...dotOverlayStyle(hasDependents), bottom: -HANDLE_SIZE / 2 }}>{hasDependents ? '−' : '+'}</div>
      </div>
      {data.onInsertAfter && (
        <button
          onClick={(e) => { e.stopPropagation(); data.onInsertAfter(a) }}
          title="Inserir nova etapa depois desta"
          style={{
            position: 'absolute', top: '50%', right: -16, transform: 'translateY(-50%)',
            width: 26, height: 26, borderRadius: '50%', border: `2px solid ${C.white}`,
            background: C.black, color: C.white, cursor: 'pointer', zIndex: 5,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 800, lineHeight: 1, boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
          }}
        >
          +
        </button>
      )}
    </div>
  )
}

// ─── Balão satélite (materiais / equipamentos / observações) ─────────────────
// Pequenos nós conectados à etapa, tipo mapa mental (Obsidian) dentro do
// próprio fluxo — clicar abre a aba correspondente no painel da etapa.
function BalloonNode({ data }) {
  return (
    <div
      onClick={(e) => { e.stopPropagation(); data.onOpen?.() }}
      title={data.title}
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'center', gap: 5,
        background: C.white, border: `1.5px solid ${data.color}`,
        borderRadius: 999, padding: '5px 11px', fontSize: 11, fontWeight: 700,
        color: data.color, boxShadow: '0 1px 5px rgba(0,0,0,0.12)',
        cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: FONT_BODY,
      }}
    >
      {/* Handle invisível — garante que a linha de conexão até o card de origem seja desenhada */}
      <Handle type="target" position={Position.Top} style={{ opacity: 0, pointerEvents: 'none', width: 1, height: 1, left: '50%' }} />
      <Icon name={data.icon} size={12} color={data.color} />
      {data.label}
    </div>
  )
}

const nodeTypes = { activityNode: ActivityNode, balloonNode: BalloonNode }

// Gera os balões satélites de uma etapa (materiais, equipamentos, observações)
// posicionados ao redor do card, como filhos num mapa mental.
function buildBalloons(a, pos, mats) {
  const out = []
  const equip = a.equipment || []
  const obsArr = parseObsList(a.observacoes)
  if (mats.length) {
    out.push({
      key: 'mat', icon: 'package', color: C.amber,
      label: `${mats.length} material${mats.length > 1 ? 'is' : ''}`,
      title: mats.map(m => `${m.name} (${m.status})`).join('\n'),
      offset: { x: -70, y: 236 }, tab: 'mat',
    })
  }
  if (equip.length) {
    out.push({
      key: 'equip', icon: 'construction', color: C.blue,
      label: `${equip.length} equip.`,
      title: equip.map(e => typeof e === 'string' ? e : (e.qty > 1 ? `${e.qty}x ${e.name}` : e.name)).join('\n'),
      offset: { x: 230, y: 236 }, tab: 'equipe',
    })
  }
  if (obsArr.length) {
    out.push({
      key: 'obs', icon: 'warning', color: C.red,
      label: `${obsArr.length} obs.`,
      title: obsListToText(obsArr),
      offset: { x: 80, y: -78 }, tab: 'geral',
    })
  }
  return out.map(b => ({
    id: `${a.id}__${b.key}`,
    activityId: a.id,
    tab: b.tab,
    position: { x: pos.x + b.offset.x, y: pos.y + b.offset.y },
    icon: b.icon, color: b.color, label: b.label, title: b.title,
  }))
}

// ─── Main component ─────────────────────────────────────────────────────────
export default function Flowchart({ projectId, userId, project, activities = [], materials = [], currentWeek, aiLogs = [], onActivityPatch, onActivityCreated, onActivityDeleted, onSaveAiLog }) {
  const positions = useMemo(() => layout(activities), [activities])

  const materialsByActivity = useMemo(() => {
    const m = {}
    materials.forEach(x => { (m[x.activity_id] ||= []).push(x) })
    return m
  }, [materials])

  const hasDependentsSet = useMemo(() => {
    const s = new Set()
    activities.forEach(a => (a.predecessor_ids || []).forEach(pid => s.add(pid)))
    return s
  }, [activities])

  const initialNodes = useMemo(() => {
    const out = activities.map(a => ({
      id: a.id,
      type: 'activityNode',
      position: positions[a.id] || { x: 0, y: 0 },
      data: {
        activity: a,
        materials: materialsByActivity[a.id] || [],
        hasDependents: hasDependentsSet.has(a.id),
        onOpen: (act) => { setOpenTab('geral'); setOpenNode(act) },
        onInsertAfter: (act) => handleInsertAfter(act),
      },
    }))
    activities.forEach(a => {
      const pos = positions[a.id] || { x: 0, y: 0 }
      const mats = materialsByActivity[a.id] || []
      buildBalloons(a, pos, mats).forEach(b => {
        out.push({
          id: b.id,
          type: 'balloonNode',
          position: b.position,
          draggable: true,
          selectable: true,
          data: {
            icon: b.icon, color: b.color, label: b.label, title: b.title,
            onOpen: () => setBalloonPopup({ activityId: a.id, activityName: a.name, icon: b.icon, color: b.color, label: b.label, title: b.title, tab: b.tab }),
          },
        })
      })
    })
    return out
  }, [activities, positions, materialsByActivity, hasDependentsSet]) // eslint-disable-line

  const byId = useMemo(() => Object.fromEntries(activities.map(a => [a.id, a])), [activities])

  const initialEdges = useMemo(() => {
    const out = []
    activities.forEach(a => {
      ;(a.predecessor_ids || []).forEach(pid => {
        if (!byId[pid]) return
        const dashed = a.status === 'atrasado'
        out.push({
          id: `${pid}->${a.id}`,
          source: pid,
          target: a.id,
          markerEnd: { type: MarkerType.ArrowClosed, color: dashed ? C.red : C.gray400 },
          style: { stroke: dashed ? C.red : (a.status === 'concluido' ? C.green : '#9CA3AF'), strokeWidth: 2, strokeDasharray: dashed ? '5 4' : undefined },
        })
      })
      const pos = positions[a.id] || { x: 0, y: 0 }
      const mats = materialsByActivity[a.id] || []
      buildBalloons(a, pos, mats).forEach(b => {
        out.push({
          id: `${a.id}->${b.id}`,
          source: a.id,
          target: b.id,
          selectable: false,
          style: { stroke: b.color, strokeWidth: 1.5, strokeDasharray: '3 3', opacity: 0.55 },
        })
      })
    })
    return out
  }, [activities, byId, positions, materialsByActivity])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [openNode, setOpenNode] = useState(null)
  const [openTab, setOpenTab] = useState('geral')
  const [aiOpen, setAiOpen] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [showHelp, setShowHelp] = useState(false)
  const [flowInstance, setFlowInstance] = useState(null)
  const [panel, setPanel] = useState(null) // null | 'search' | 'summary'
  const [query, setQuery] = useState('')
  const [balloonPopup, setBalloonPopup] = useState(null)

  function focusActivity(act) {
    const node = nodes.find(n => n.id === act.id)
    const pos = node?.position || positions[act.id] || { x: 0, y: 0 }
    flowInstance?.setCenter(pos.x + 140, pos.y + 90, { zoom: 1.1, duration: 500 })
    setPanel(null)
  }

  function handleEtapaAtual() {
    const emAndamento = activities.filter(a => a.status === 'em_andamento')
    let alvo = emAndamento[0]
    if (!alvo && currentWeek) {
      alvo = activities.find(a => a.status !== 'concluido' && a.week_start <= currentWeek && a.week_end >= currentWeek)
    }
    if (!alvo) {
      setSaveError('Nenhuma etapa em andamento no momento.')
      return
    }
    focusActivity(alvo)
  }

  // Re-sync when upstream activities change (e.g. edited elsewhere) without
  // losing in-flight drag state — simplest safe approach: replace fully.
  const lastActIds = useRef('')
  const matsSig = materials.map(m => `${m.activity_id}:${m.id}:${m.status}:${m.name}:${m.responsible_name || ''}`).join(',')
  const sig = activities.map(a => `${a.id}:${a.name}:${a.status}:${a.pct}:${a.flow_x}:${a.flow_y}:${a.observacoes || ''}:${(a.predecessor_ids || []).join(',')}`).join('|') + '||' + matsSig
  if (sig !== lastActIds.current) {
    lastActIds.current = sig
    setNodes(initialNodes)
    setEdges(initialEdges)
  }

  const onConnect = useCallback((params) => {
    const { source, target } = params
    if (!source || !target || source === target) return
    const targetAct = byId[target]
    if (!targetAct) return
    const current = targetAct.predecessor_ids || []
    if (current.includes(source)) return
    const next = [...current, source]
    setEdges(eds => addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed, color: C.gray400 }, style: { stroke: '#9CA3AF', strokeWidth: 2 } }, eds))
    onActivityPatch?.(target, { predecessor_ids: next })
    updateActivityFields(target, { predecessor_ids: next })
      .then(({ error }) => { if (error) setSaveError('Não consegui salvar a dependência: ' + error.message) })
      .catch(err => setSaveError('Não consegui salvar a dependência: ' + (err?.message || 'erro desconhecido')))
  }, [byId, onActivityPatch, setEdges])

  const onEdgesDelete = useCallback((deleted) => {
    deleted.forEach(e => {
      const targetAct = byId[e.target]
      if (!targetAct) return
      const next = (targetAct.predecessor_ids || []).filter(id => id !== e.source)
      onActivityPatch?.(e.target, { predecessor_ids: next })
      updateActivityFields(e.target, { predecessor_ids: next })
        .then(({ error }) => { if (error) setSaveError('Não consegui remover a dependência: ' + error.message) })
        .catch(err => setSaveError('Não consegui remover a dependência: ' + (err?.message || 'erro desconhecido')))
    })
  }, [byId, onActivityPatch])

  const onNodeDragStop = useCallback((evt, node) => {
    // Balõezinhos são livres pra arrastar, mas não têm posição persistida no
    // banco (só servem de atalho visual) — move só localmente.
    if (node.type === 'balloonNode' || !byId[node.id]) return
    // Cards são livres — o usuário posiciona onde quiser.
    const flow_x = node.position.x, flow_y = node.position.y
    onActivityPatch?.(node.id, { flow_x, flow_y })
    updateActivityFields(node.id, { flow_x, flow_y })
      .then(({ error }) => { if (error) setSaveError('Não consegui salvar a posição: ' + error.message) })
      .catch(err => setSaveError('Não consegui salvar a posição: ' + (err?.message || 'erro desconhecido')))
  }, [byId, onActivityPatch, setNodes])

  // Clique num nó — se for um balãozinho, abre o popup com a informação
  // (via onNodeClick do próprio React Flow, mais confiável do que o onClick
  // interno do card, que podia ser engolido pelo drag/seleção do canvas).
  const onNodeClick = useCallback((evt, node) => {
    if (node.type === 'balloonNode') node.data?.onOpen?.()
  }, [])

  // Duplo clique num nó cancela (remove) os vínculos de dependência dele
  const onNodeDoubleClick = useCallback((evt, node) => {
    const act = byId[node.id]
    if (!act || !(act.predecessor_ids || []).length) return
    if (!confirm(`Remover todas as dependências de "${act.name}"? As setas que chegam nela serão apagadas.`)) return
    setEdges(eds => eds.filter(e => e.target !== node.id))
    onActivityPatch?.(node.id, { predecessor_ids: [] })
    updateActivityFields(node.id, { predecessor_ids: [] })
      .then(({ error }) => { if (error) setSaveError('Não consegui remover a dependência: ' + error.message) })
      .catch(err => setSaveError('Não consegui remover a dependência: ' + (err?.message || 'erro desconhecido')))
  }, [byId, onActivityPatch, setEdges])

  // A IA do fluxograma age como agente: aplica diretivas LIGAR/PRAZO que ela
  // propõe, reorganizando de verdade a rede (dependências + posição) e
  // persistindo no banco — não é só um chat de texto. O reposicionamento usa
  // o layout em colunas (computeFramedPositions): cada nível de profundidade
  // vira uma linha, tarefas paralelas/complementares do mesmo nível ficam
  // lado a lado, centralizadas — um fluxo organizado e enquadrado.
  const [applyingAi, setApplyingAi] = useState(false)
  async function handleApplyAiDirectives(ligarList, prazoList, renomearList = []) {
    if (!ligarList.length && !prazoList.length && !renomearList.length) return { applied: 0, changedIds: [], changedNames: [] }
    setApplyingAi(true)
    try {
      const working = activities.map(a => ({ ...a }))
      const byIdWorking = Object.fromEntries(working.map(a => [a.id, a]))
      ligarList.forEach(({ id, predecessor_ids }) => { if (byIdWorking[id]) byIdWorking[id].predecessor_ids = predecessor_ids })
      prazoList.forEach(({ id, week_start, week_end }) => {
        if (byIdWorking[id]) { byIdWorking[id].week_start = week_start; byIdWorking[id].week_end = week_end }
      })
      renomearList.forEach(({ id, name }) => { if (byIdWorking[id]) byIdWorking[id].name = name })
      const framed = computeFramedPositions(working)
      // ids explicitamente apontados pela IA (o que o usuário pediu pra mudar)
      // — usado pra destacar no fluxograma onde a alteração aconteceu.
      const directiveIds = new Set([...ligarList.map(x => x.id), ...prazoList.map(x => x.id), ...renomearList.map(x => x.id)])
      const touchedIds = new Set(directiveIds)
      let applied = 0
      for (const a of working) {
        const newPos = framed[a.id] || { x: 0, y: 0 }
        const changed = touchedIds.has(a.id) || Number(a.flow_y) !== newPos.y || Number(a.flow_x) !== newPos.x
        if (!changed) continue
        const patch = {
          name: a.name,
          predecessor_ids: a.predecessor_ids || [],
          week_start: a.week_start,
          week_end: a.week_end,
          flow_x: newPos.x,
          flow_y: newPos.y,
        }
        onActivityPatch?.(a.id, patch)
        const { error } = await updateActivityFields(a.id, patch)
        if (error) { setSaveError('Não consegui aplicar a reorganização da IA: ' + error.message); continue }
        applied++
      }
      const changedIds = Array.from(directiveIds)
      const changedNames = changedIds.map(id => byIdWorking[id]?.name).filter(Boolean)
      return { applied, changedIds, changedNames }
    } finally {
      setApplyingAi(false)
    }
  }

  // Destaca (borda laranja temporária) e centraliza a vista nas etapas que a
  // IA acabou de alterar, pra mostrar exatamente onde a alteração aconteceu.
  const highlightTimer = useRef(null)
  function highlightActivities(ids) {
    if (!ids || !ids.length) return
    const idSet = new Set(ids)
    setNodes(nds => nds.map(n => idSet.has(n.id) ? { ...n, data: { ...n.data, highlighted: true } } : n))
    flowInstance?.fitView({ nodes: ids.map(id => ({ id })), duration: 500, padding: 0.4, maxZoom: 1.2 })
    if (highlightTimer.current) clearTimeout(highlightTimer.current)
    highlightTimer.current = setTimeout(() => {
      setNodes(nds => nds.map(n => n.data?.highlighted ? { ...n, data: { ...n.data, highlighted: false } } : n))
    }, 4500)
  }

  // Botão "+" do card: insere uma nova etapa logo depois desta na cadeia
  // vertical, reencaixando quem antes dependia dela para depender da nova.
  async function handleInsertAfter(act) {
    const dependents = activities.filter(x => (x.predecessor_ids || []).includes(act.id))
    const baseY = Number(act.flow_y ?? 0)
    const row = {
      project_id: projectId,
      name: 'Nova etapa',
      group_name: act.group_name || 'Geral',
      week_start: act.week_end || act.week_start || 1,
      week_end: act.week_end || act.week_start || 1,
      tipo: 'exec',
      pct: 0,
      status: 'nao_iniciado',
      order_index: activities.length,
      predecessor_ids: [act.id],
      flow_x: 0,
      flow_y: baseY + ROW_H / 2,
    }
    const { data, error } = await createActivity(row)
    if (error || !data) {
      setSaveError('Não consegui criar a etapa: ' + (error?.message || 'erro desconhecido'))
      return
    }
    onActivityCreated?.(data)
    for (const dep of dependents) {
      const nextPreds = (dep.predecessor_ids || []).filter(id => id !== act.id).concat(data.id)
      onActivityPatch?.(dep.id, { predecessor_ids: nextPreds })
      updateActivityFields(dep.id, { predecessor_ids: nextPreds })
        .then(({ error }) => { if (error) setSaveError('Não consegui reencadear a etapa seguinte: ' + error.message) })
        .catch(err => setSaveError('Não consegui reencadear a etapa seguinte: ' + (err?.message || 'erro desconhecido')))
    }
    setOpenNode(data)
  }

  async function handleAddStage() {
    // Continua a cadeia vertical: a nova etapa entra depois da última
    // (maior flow_y), com ela como predecessora — nunca abre uma coluna nova.
    let last = null
    activities.forEach(a => {
      const y = Number(a.flow_y ?? 0)
      if (!last || y > Number(last.flow_y ?? 0)) last = a
    })
    const maxY = last ? Number(last.flow_y ?? 0) : -ROW_H
    const row = {
      project_id: projectId,
      name: 'Nova etapa',
      group_name: 'Geral',
      week_start: currentWeek || 1,
      week_end: currentWeek || 1,
      tipo: 'exec',
      pct: 0,
      status: 'nao_iniciado',
      order_index: activities.length,
      predecessor_ids: last ? [last.id] : [],
      flow_x: 0,
      flow_y: maxY + ROW_H,
    }
    const { data, error } = await createActivity(row)
    if (!error && data) {
      onActivityCreated?.(data)
      setOpenNode(data)
    }
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  return (
    <div style={{ position: 'relative', height: 'calc(100vh - 230px)', minHeight: 480, background: C.white, borderRadius: 10, border: `1px solid ${C.gray200}`, overflow: 'hidden' }}>
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgesDelete={onEdgesDelete}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onInit={setFlowInstance}
          deleteKeyCode={['Backspace', 'Delete']}
          fitView
          minZoom={0.1}
          maxZoom={2.5}
          zoomOnScroll
          panOnScroll={false}
          selectionOnDrag
        >
          <Background color={C.gray200} gap={24} />
          <Controls showInteractive={false} showZoom showFitView position="bottom-left" style={{ zIndex: 15 }} />
          {!isMobile && <MiniMap pannable zoomable style={{ background: C.gray50 }} />}
        </ReactFlow>
      </ReactFlowProvider>

      {/* Toolbar */}
      <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 10, maxWidth: 320 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn size="sm" icon="plus" onClick={handleAddStage}>Nova etapa</Btn>
          <Btn size="sm" icon="mapPin" variant="secondary" onClick={handleEtapaAtual} title="Ir pra etapa em andamento">Etapa atual</Btn>
          <button
            onClick={() => setPanel(p => p === 'search' ? null : 'search')}
            title="Pesquisar etapas"
            style={{
              width: 32, height: 32, borderRadius: 7, border: `1px solid ${C.gray200}`,
              background: panel === 'search' ? C.orangeLight : C.white, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Icon name="search" size={15} color={panel === 'search' ? C.orange : C.gray700} />
          </button>
          <button
            onClick={() => setPanel(p => p === 'summary' ? null : 'summary')}
            title="Sumário das etapas"
            style={{
              width: 32, height: 32, borderRadius: 7, border: `1px solid ${C.gray200}`,
              background: panel === 'summary' ? C.orangeLight : C.white, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Icon name="list" size={15} color={panel === 'summary' ? C.orange : C.gray700} />
          </button>
        </div>
        {saveError && (
          <div onClick={() => setSaveError('')} style={{ cursor: 'pointer' }}>
            <Alert type="error">{saveError}</Alert>
          </div>
        )}
        {panel && (
          <div style={{
            width: 280, maxHeight: 420, background: C.white, border: `1px solid ${C.gray200}`,
            borderRadius: 10, boxShadow: '0 6px 20px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <div style={{ padding: 10, borderBottom: `1px solid ${C.gray200}` }}>
              <Input
                autoFocus={panel === 'search'}
                placeholder="Buscar etapa ou grupo..."
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
            <div style={{ overflowY: 'auto', padding: 6 }}>
              {(() => {
                const q = query.trim().toLowerCase()
                const filtered = activities.filter(a =>
                  !q || a.name.toLowerCase().includes(q) || (a.group_name || '').toLowerCase().includes(q)
                )
                if (!filtered.length) return <div style={{ padding: 12, fontSize: 12, color: C.gray500 }}>Nenhuma etapa encontrada.</div>
                const groups = {}
                filtered.forEach(a => { (groups[a.group_name || 'Geral'] ||= []).push(a) })
                return Object.entries(groups).map(([g, items]) => (
                  <div key={g} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: groupColor(g), padding: '4px 8px' }}>
                      {g}
                    </div>
                    {items.map(a => {
                      const sc = STATUS_COLORS[a.status] || STATUS_COLORS.nao_iniciado
                      return (
                        <button
                          key={a.id}
                          onClick={() => focusActivity(a)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                            padding: '6px 8px', border: 'none', background: 'none', cursor: 'pointer', borderRadius: 6,
                          }}
                        >
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: sc.cor, flexShrink: 0 }} />
                          <span style={{ flex: 1, fontSize: 12, color: C.black, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                          <span style={{ fontSize: 10, color: C.gray400, flexShrink: 0 }}>{a.pct || 0}%</span>
                        </button>
                      )
                    })}
                  </div>
                ))
              })()}
            </div>
          </div>
        )}
      </div>
      {/* Ajuda — discreta, não sobrepõe outros controles */}
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10 }}>
        <button
          onClick={() => setShowHelp(h => !h)}
          title="Ajuda"
          style={{
            width: 26, height: 26, borderRadius: '50%', border: `1px solid ${C.gray200}`,
            background: 'rgba(255,255,255,0.92)', color: C.gray500, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 800, fontFamily: FONT_DISPLAY, boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
          }}
        >
          ?
        </button>
        {showHelp && (
          <div style={{
            position: 'absolute', top: 32, right: 0, width: 240,
            background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 8,
            padding: '8px 10px', fontSize: 11, color: C.gray500, lineHeight: 1.5,
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          }}>
            Arraste do ponto "+" de um card até outro pra criar dependência. Selecione uma seta e aperte Delete pra remover, ou dê dois cliques num nó pra remover as dependências dele.
          </div>
        )}
      </div>

      {/* Floating AI button */}
      <button
        onClick={() => setAiOpen(true)}
        title="IA do fluxograma"
        style={{
          position: 'absolute', bottom: isMobile ? 24 : 20, right: 20, zIndex: 10,
          width: 52, height: 52, borderRadius: '50%', background: C.orange, border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(232,80,10,0.45)',
        }}
      >
        <Icon name="chat" size={22} color={C.white} />
      </button>

      {openNode && (
        <NodeDetail
          key={openNode.id}
          activity={byId[openNode.id] || openNode}
          allActivities={activities}
          materials={materials}
          projectId={projectId}
          userId={userId}
          initialTab={openTab}
          onClose={() => setOpenNode(null)}
          onPatch={(patch) => onActivityPatch?.(openNode.id, patch)}
          onDelete={async () => {
            if (!confirm(`Excluir a etapa "${openNode.name}"? As setas que dependem dela também serão removidas.`)) return
            await deleteActivity(openNode.id)
            onActivityDeleted?.(openNode.id)
            setOpenNode(null)
          }}
        />
      )}

      {balloonPopup && (
        <div
          onClick={() => setBalloonPopup(null)}
          style={{
            position: 'absolute', inset: 0, zIndex: 25,
            background: 'rgba(0,0,0,0.28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 320, maxWidth: '90%', maxHeight: '70%', background: C.white,
              borderRadius: 14, border: `1.5px solid ${balloonPopup.color}`,
              boxShadow: '0 12px 40px rgba(0,0,0,0.3)', padding: 16,
              display: 'flex', flexDirection: 'column', fontFamily: FONT_BODY,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%', background: balloonPopup.color + '22',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon name={balloonPopup.icon} size={13} color={balloonPopup.color} />
              </div>
              <div style={{ fontWeight: 800, fontSize: 14, color: balloonPopup.color, flex: 1 }}>
                {balloonPopup.label}
              </div>
              <button onClick={() => setBalloonPopup(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gray400, padding: 2 }}>
                <Icon name="x" size={16} />
              </button>
            </div>
            <div style={{ fontSize: 10, color: C.gray400, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10 }}>
              Etapa: {balloonPopup.activityName}
            </div>
            <div style={{
              fontSize: 13, color: C.black, lineHeight: 1.6, whiteSpace: 'pre-wrap',
              overflowY: 'auto', flex: 1, marginBottom: 12,
            }}>
              {balloonPopup.title || 'Sem informações.'}
            </div>
            <Btn
              size="sm"
              onClick={() => {
                const act = byId[balloonPopup.activityId]
                setOpenTab(balloonPopup.tab)
                if (act) setOpenNode(act)
                setBalloonPopup(null)
              }}
              style={{ justifyContent: 'center' }}
            >
              Abrir etapa completa
            </Btn>
          </div>
        </div>
      )}

      {aiOpen && (
        <AIFluxoPanel
          project={project}
          activities={activities}
          aiLogs={aiLogs}
          currentWeek={currentWeek}
          isMobile={isMobile}
          onApplyDirectives={handleApplyAiDirectives}
          onHighlight={highlightActivities}
          onSaveAiLog={onSaveAiLog}
          onClose={() => setAiOpen(false)}
        />
      )}
    </div>
  )
}

// ─── Node detail — "pasta" da etapa ────────────────────────────────────────
const DETAIL_TABS = [
  { key: 'geral',   label: 'Visão geral', icon: 'file'    },
  { key: 'equipe',  label: 'Equipe',      icon: 'users'   },
  { key: 'mat',     label: 'Materiais',   icon: 'package' },
  { key: 'docs',    label: 'Plantas',     icon: 'copy'    },
  { key: 'rel',     label: 'Relatório',   icon: 'chart'   },
]

function NodeDetail({ activity, allActivities, materials, projectId, userId, initialTab, onClose, onPatch, onDelete }) {
  const [tab, setTab] = useState(initialTab || 'geral')
  useEffect(() => { if (initialTab) setTab(initialTab) }, [initialTab])
  const [form, setForm] = useState({
    name: activity.name || '',
    group_name: activity.group_name || 'Geral',
    status: activity.status || 'nao_iniciado',
    pct: activity.pct ?? 0,
    week_start: activity.week_start ?? 1,
    week_end: activity.week_end ?? 1,
  })
  const [obsList, setObsList] = useState(() => {
    const list = parseObsList(activity.observacoes)
    return list.length ? list : ['']
  })
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  const existingGroups = useMemo(() => {
    const set = new Set()
    allActivities.forEach(a => { if (a.group_name) set.add(a.group_name) })
    set.add(form.group_name || 'Geral')
    return Array.from(set).sort((x, y) => x.localeCompare(y, 'pt-BR'))
  }, [allActivities, form.group_name])

  const [creatingGroup, setCreatingGroup] = useState(false)

  function updateObs(idx, value) {
    setObsList(list => list.map((o, i) => i === idx ? value : o))
  }
  function addObs() {
    setObsList(list => [...list, ''])
  }
  function removeObs(idx) {
    setObsList(list => {
      const next = list.filter((_, i) => i !== idx)
      return next.length ? next : ['']
    })
  }

  async function handleSaveGeral() {
    setSaving(true)
    try {
      const patch = {
        name: form.name.trim() || activity.name,
        group_name: form.group_name.trim() || 'Geral',
        status: form.status,
        pct: Number(form.pct) || 0,
        week_start: Number(form.week_start) || 1,
        week_end: Number(form.week_end) || 1,
        observacoes: stringifyObsList(obsList),
      }
      if (patch.status === 'concluido') patch.pct = 100
      const { error } = await updateActivityFields(activity.id, patch)
      if (!error) {
        onPatch(patch)
        setSavedMsg('Salvo')
        setTimeout(() => setSavedMsg(''), 1800)
      }
    } finally {
      setSaving(false)
    }
  }

  const preds = (activity.predecessor_ids || []).map(id => allActivities.find(a => a.id === id)).filter(Boolean)
  const dependents = allActivities.filter(a => (a.predecessor_ids || []).includes(activity.id))

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0,
      width: 'min(440px, 100%)', background: C.white, zIndex: 20,
      borderLeft: `1px solid ${C.gray200}`, boxShadow: '-6px 0 24px rgba(0,0,0,0.12)',
      display: 'flex', flexDirection: 'column', fontFamily: FONT_BODY,
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.gray200}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, color: C.gray400, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Etapa</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 17, color: C.black, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {activity.name}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gray500, padding: 4 }}>
          <Icon name="x" size={18} />
        </button>
      </div>

      {/* Mini tabs */}
      <div style={{ display: 'flex', overflowX: 'auto', borderBottom: `1px solid ${C.gray200}` }}>
        {DETAIL_TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '9px 12px', border: 'none', background: 'none',
            cursor: 'pointer', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
            color: tab === t.key ? C.orange : C.gray500,
            borderBottom: `2px solid ${tab === t.key ? C.orange : 'transparent'}`,
          }}>
            <Icon name={t.icon} size={12} color={tab === t.key ? C.orange : C.gray500} />
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {tab === 'geral' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <Label>Nome da etapa</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>Grupo</Label>
              {creatingGroup ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <Input
                    autoFocus
                    placeholder="Nome do novo grupo"
                    value={form.group_name}
                    onChange={e => setForm(f => ({ ...f, group_name: e.target.value }))}
                  />
                  <button
                    type="button"
                    onClick={() => setCreatingGroup(false)}
                    title="Escolher grupo existente"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 38, border: `1px solid ${C.gray200}`, borderRadius: 8,
                      background: C.gray100, cursor: 'pointer', color: C.gray500,
                    }}
                  >
                    <Icon name="x" size={14} color={C.gray500} />
                  </button>
                </div>
              ) : (
                <Select
                  value={form.group_name}
                  onChange={e => {
                    if (e.target.value === '__new__') {
                      setForm(f => ({ ...f, group_name: '' }))
                      setCreatingGroup(true)
                    } else {
                      setForm(f => ({ ...f, group_name: e.target.value }))
                    }
                  }}
                >
                  {existingGroups.map(g => <option key={g} value={g}>{g}</option>)}
                  <option value="__new__">+ Criar novo grupo…</option>
                </Select>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <Label>Status</Label>
                <Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </Select>
              </div>
              <div style={{ width: 90 }}>
                <Label>% avanço</Label>
                <Input type="number" min={0} max={100} value={form.pct} onChange={e => setForm(f => ({ ...f, pct: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <Label>Semana início</Label>
                <Input type="number" min={1} value={form.week_start} onChange={e => setForm(f => ({ ...f, week_start: e.target.value }))} />
              </div>
              <div style={{ flex: 1 }}>
                <Label>Semana fim</Label>
                <Input type="number" min={1} value={form.week_end} onChange={e => setForm(f => ({ ...f, week_end: e.target.value }))} />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <Label style={{ marginBottom: 0 }}>{form.status === 'atrasado' ? 'Motivo da parada' : 'Observações'}</Label>
                <button
                  type="button"
                  onClick={addObs}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none',
                    cursor: 'pointer', color: C.orange, fontSize: 11, fontWeight: 700, padding: '2px 4px',
                  }}
                >
                  <Icon name="plus" size={12} color={C.orange} /> Add obs
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {obsList.map((obs, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: C.gray400, fontWeight: 700, marginBottom: 2 }}>
                        Obs {String(idx + 1).padStart(2, '0')}
                      </div>
                      <Textarea
                        rows={2}
                        placeholder={form.status === 'atrasado' && idx === 0 ? '⚠ Por que essa etapa parou?' : 'Observação...'}
                        value={obs}
                        onChange={e => updateObs(idx, e.target.value)}
                        style={form.status === 'atrasado' && idx === 0 ? { borderColor: C.red, background: C.redLight } : {}}
                      />
                    </div>
                    {(obsList.length > 1 || obs) && (
                      <button
                        type="button"
                        onClick={() => removeObs(idx)}
                        title="Remover observação"
                        style={{
                          marginTop: 16, background: 'none', border: 'none', cursor: 'pointer',
                          color: C.gray400, padding: 2,
                        }}
                      >
                        <Icon name="x" size={14} color={C.gray400} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {preds.length > 0 && (
              <div>
                <Label>Depende de</Label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {preds.map(p => <Badge key={p.id} label={p.name} bg={C.gray100} cor={C.gray700} />)}
                </div>
              </div>
            )}
            {dependents.length > 0 && (
              <div>
                <Label>Libera</Label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {dependents.map(d => <Badge key={d.id} label={d.name} bg={C.orangeLight} cor={C.orange} />)}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <Btn icon={saving ? undefined : 'check'} onClick={handleSaveGeral} disabled={saving} style={{ flex: 1, justifyContent: 'center' }}>
                {saving ? 'Salvando...' : (savedMsg || 'Salvar')}
              </Btn>
              <Btn variant="danger" icon="trash" onClick={onDelete} />
            </div>
          </div>
        )}

        {tab === 'equipe' && <EquipeTab activity={activity} onPatch={onPatch} />}
        {tab === 'mat' && <MateriaisTab activity={activity} materials={materials} projectId={projectId} />}
        {tab === 'docs' && <DocsTab activity={activity} projectId={projectId} userId={userId} />}
        {tab === 'rel' && <RelatorioTab activity={activity} projectId={projectId} />}
      </div>
    </div>
  )
}

// ─── Equipe (atores envolvidos) ─────────────────────────────────────────────
function EquipeTab({ activity, onPatch }) {
  const [workers, setWorkers] = useState(activity.workers && activity.workers.length ? activity.workers : [])
  const [role, setRole] = useState('')
  const [qty, setQty] = useState(1)
  const [saving, setSaving] = useState(false)

  function addRow() {
    if (!role.trim()) return
    setWorkers(w => [...w, { role: role.trim(), qty: Number(qty) || 1 }])
    setRole(''); setQty(1)
  }
  function removeRow(i) {
    setWorkers(w => w.filter((_, idx) => idx !== i))
  }
  async function save() {
    setSaving(true)
    try {
      await updateActivityFields(activity.id, { workers })
      onPatch({ workers })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 12, color: C.gray500 }}>Atores envolvidos nesta etapa (mão de obra / equipe responsável).</div>
      {workers.length === 0 && <Empty icon="users" text="Nenhum profissional cadastrado" />}
      {workers.map((w, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: C.gray50, borderRadius: 6 }}>
          <Icon name="users" size={14} color={C.gray500} />
          <div style={{ flex: 1, fontSize: 13, color: C.black }}>{w.qty}x {w.role}</div>
          <button onClick={() => removeRow(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red }}>
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6 }}>
        <Input style={{ width: 56 }} type="number" min={1} value={qty} onChange={e => setQty(e.target.value)} />
        <Input style={{ flex: 1 }} placeholder="Função (ex: pedreiro)" value={role} onChange={e => setRole(e.target.value)} onKeyDown={e => e.key === 'Enter' && addRow()} />
        <Btn size="sm" icon="plus" variant="secondary" onClick={addRow} />
      </div>
      <Btn icon="check" onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar equipe'}</Btn>
    </div>
  )
}

// ─── Materiais da etapa ──────────────────────────────────────────────────────
function MateriaisTab({ activity, materials, projectId }) {
  const mine = materials.filter(m => m.activity_id === activity.id)
  const [list, setList] = useState(mine)
  const [name, setName] = useState('')
  const [qtd, setQtd] = useState('')
  const [unit, setUnit] = useState('un')
  const [responsavel, setResponsavel] = useState('')
  const [adding, setAdding] = useState(false)

  async function addMaterial() {
    if (!name.trim()) return
    setAdding(true)
    try {
      const { data } = await upsertMaterial({
        project_id: projectId,
        activity_id: activity.id,
        name: name.trim(),
        quantity: Number(qtd) || 0,
        unit,
        status: 'pendente',
        week: activity.week_start,
        responsible_name: responsavel.trim() || null,
      })
      if (data) setList(l => [...l, data])
      setName(''); setQtd(''); setResponsavel('')
    } finally {
      setAdding(false)
    }
  }
  async function removeMaterial(id) {
    await deleteMaterial(id)
    setList(l => l.filter(m => m.id !== id))
  }
  async function confirmMaterial(id) {
    const { data, error } = await updateMaterialStatus(id, 'chegou')
    if (!error) setList(l => l.map(m => m.id === id ? (data || { ...m, status: 'chegou' }) : m))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 12, color: C.gray500 }}>Materiais previstos/usados nesta etapa. Dê o OK quando o material chegar pra sair da pendência.</div>
      {list.length === 0 && <Empty icon="package" text="Nenhum material vinculado" />}
      {list.map(m => {
        const sm = STATUS_MAT[m.status] || STATUS_MAT.pendente
        const pending = m.status !== 'chegou'
        return (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: C.gray50, borderRadius: 6 }}>
            <Icon name="package" size={14} color={C.gray500} />
            <div style={{ flex: 1, fontSize: 13, color: C.black }}>{m.name} — {m.quantity} {m.unit}{m.responsible_name ? ` · Resp.: ${m.responsible_name}` : ''}</div>
            <Badge label={sm.label} bg={sm.bg} cor={sm.cor} />
            {pending && (
              <button
                onClick={() => confirmMaterial(m.id)}
                title="Confirmar chegada do material (OK)"
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, border: 'none', cursor: 'pointer',
                  background: C.greenLight, color: C.green, borderRadius: 6, padding: '4px 8px',
                  fontSize: 11, fontWeight: 700,
                }}
              >
                <Icon name="check" size={12} color={C.green} /> OK
              </button>
            )}
            <button onClick={() => removeMaterial(m.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red }}>
              <Icon name="x" size={14} />
            </button>
          </div>
        )
      })}
      <div style={{ display: 'flex', gap: 6 }}>
        <Input style={{ flex: 1 }} placeholder="Material" value={name} onChange={e => setName(e.target.value)} />
        <Input style={{ width: 60 }} placeholder="Qtd" value={qtd} onChange={e => setQtd(e.target.value)} />
        <Select style={{ width: 70 }} value={unit} onChange={e => setUnit(e.target.value)}>
          {['un', 'kg', 'sc', 'm³', 'm²', 'm', 'vb'].map(u => <option key={u} value={u}>{u}</option>)}
        </Select>
      </div>
      <Input placeholder="Responsável pelo material" value={responsavel} onChange={e => setResponsavel(e.target.value)} />
      <Btn size="sm" icon="plus" onClick={addMaterial} disabled={adding}>Adicionar material</Btn>
    </div>
  )
}

// ─── Plantas / documentos ────────────────────────────────────────────────────
function DocsTab({ activity, projectId, userId }) {
  const [docs, setDocs] = useState(null)
  const [discipline, setDiscipline] = useState('Geral')
  const [docName, setDocName] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => { load() }, []) // eslint-disable-line
  async function load() {
    const { data } = await fetchActivityDocs(activity.id)
    setDocs(data || [])
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file || !docName.trim()) return
    setUploading(true)
    try {
      const { data } = await uploadActivityDoc({ activityId: activity.id, projectId, userId, file, discipline, docName: docName.trim() })
      if (data) setDocs(d => [data, ...(d || [])])
      setDocName('')
      if (fileRef.current) fileRef.current.value = ''
    } finally {
      setUploading(false)
    }
  }
  async function handleOpen(doc) {
    const { data } = await getActivityDocUrl(doc.storage_path)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }
  async function handleDelete(doc) {
    await deleteActivityDoc({ id: doc.id, storagePath: doc.storage_path })
    setDocs(d => d.filter(x => x.id !== doc.id))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 12, color: C.gray500 }}>Plantas e documentos técnicos desta etapa.</div>
      {docs === null && <Spinner />}
      {docs && docs.length === 0 && <Empty icon="copy" text="Nenhum documento enviado" />}
      {docs && docs.map(d => (
        <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: C.gray50, borderRadius: 6 }}>
          <Icon name="file" size={14} color={C.gray500} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: C.black, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.doc_name} — Rev.{String(d.revision).padStart(2, '0')}</div>
            <div style={{ fontSize: 10, color: C.gray400 }}>{d.discipline}</div>
          </div>
          <button onClick={() => handleOpen(d)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gray500 }}>
            <Icon name="download" size={14} />
          </button>
          <button onClick={() => handleDelete(d)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red }}>
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6 }}>
        <Input style={{ width: 90 }} placeholder="Disciplina" value={discipline} onChange={e => setDiscipline(e.target.value)} />
        <Input style={{ flex: 1 }} placeholder="Nome do documento" value={docName} onChange={e => setDocName(e.target.value)} />
      </div>
      <Btn size="sm" icon="upload" variant="secondary" disabled={uploading || !docName.trim()} onClick={() => fileRef.current?.click()}>
        {uploading ? 'Enviando...' : 'Enviar arquivo'}
      </Btn>
      <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleFile} />
    </div>
  )
}

// ─── Relatório vinculado ─────────────────────────────────────────────────────
function RelatorioTab({ activity, projectId }) {
  const [all, setAll] = useState(null)

  useEffect(() => { load() }, []) // eslint-disable-line
  async function load() {
    const { data } = await fetchReports(projectId)
    setAll(data || [])
  }

  const linked = (all || []).filter(r => r.activity_id === activity.id)
  const unlinked = (all || []).filter(r => !r.activity_id)

  async function link(id) {
    await linkReportToActivity(id, activity.id)
    load()
  }
  async function unlink(id) {
    await unlinkReportFromActivity(id)
    load()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 12, color: C.gray500 }}>Relatórios (gerados na aba Relatórios) vinculados a esta etapa.</div>
      {all === null && <Spinner />}
      {all && linked.length === 0 && <Empty icon="file" text="Nenhum relatório vinculado" />}
      {all && linked.map(r => (
        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: C.gray50, borderRadius: 6 }}>
          <Icon name="file" size={14} color={C.gray500} />
          <div style={{ flex: 1, fontSize: 13, color: C.black, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name || r.file_name}</div>
          <button onClick={() => unlink(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red }}>
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
      {all && unlinked.length > 0 && (
        <div>
          <Label>Vincular relatório existente</Label>
          <Select defaultValue="" onChange={e => { if (e.target.value) link(e.target.value) }}>
            <option value="">Selecione...</option>
            {unlinked.map(r => <option key={r.id} value={r.id}>{r.name || r.file_name}</option>)}
          </Select>
        </div>
      )}
    </div>
  )
}

// Normaliza nomes de etapa pra casar mesmo com pequenas diferenças de acento/
// caixa/espaço entre o que a IA devolveu e o nome real cadastrado.
function normalizeActName(s) {
  return (s || '')
    .toString()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}
function buildActByNameIndex(activities) {
  const byName = new Map()
  activities.forEach(a => byName.set(normalizeActName(a.name), a))
  return byName
}
function findActivityByName(rawName, byName, activities) {
  const key = normalizeActName(rawName)
  if (!key) return null
  if (byName.has(key)) return byName.get(key)
  // Fallback: o nome pode vir levemente diferente (abreviado, reescrito) —
  // tenta achar por correspondência parcial antes de desistir.
  const hit = activities.find(a => {
    const an = normalizeActName(a.name)
    return an.includes(key) || key.includes(an)
  })
  return hit || null
}

// A IA responde em texto + propõe diretivas de reorganização ao final:
//   LIGAR: [etapa] → depende de: [predecessora 1, predecessora 2]
//   PRAZO: [etapa] → semana_inicio: N, semana_fim: M
// Essas funções leem essas linhas e traduzem pros ids reais das atividades.
// Os "[colchetes]" no formato pedido ao modelo (ex: "LIGAR: [etapa] →
// depende de: [predecessora]") são só notação de "preencha aqui" — o GPT
// quase nunca ecoa os colchetes literalmente na resposta. Por isso todo
// parser abaixo tira colchetes residuais antes de casar o texto, em vez de
// EXIGIR que eles existam (exigir colchetes fazia toda diretiva (LIGAR/
// PRAZO/RENOMEAR/DESLIGAR) falhar silenciosamente o tempo todo).
function stripBrackets(s) {
  return (s || '').replace(/[[\]]/g, '').trim()
}
function parseLigarDirectives(text, activities) {
  const byName = buildActByNameIndex(activities)
  const out = []
  text.split('\n').forEach(line => {
    const m = line.match(/^LIGAR:\s*(.+?)\s*→\s*depende de:\s*(.*?)\s*$/)
    if (!m) return
    const act = findActivityByName(stripBrackets(m[1]), byName, activities)
    if (!act) return
    const predIds = stripBrackets(m[2]).split(',').map(s => s.trim()).filter(Boolean)
      .map(n => findActivityByName(n, byName, activities)?.id).filter(Boolean)
    out.push({ id: act.id, predecessor_ids: predIds })
  })
  return out
}
function parsePrazoDirectives(text, activities) {
  const byName = buildActByNameIndex(activities)
  const out = []
  text.split('\n').forEach(line => {
    const m = line.match(/^PRAZO:\s*(.+?)\s*→\s*semana_inicio:\s*(\d+),\s*semana_fim:\s*(\d+)/)
    if (!m) return
    const act = findActivityByName(stripBrackets(m[1]), byName, activities)
    if (!act) return
    out.push({ id: act.id, week_start: Number(m[2]), week_end: Number(m[3]) })
  })
  return out
}
function parseRenomearDirectives(text, activities) {
  const byName = buildActByNameIndex(activities)
  const out = []
  text.split('\n').forEach(line => {
    // Aceita tanto "RENOMEAR: X → novo nome: Y" quanto "RENOMEAR: X → Y"
    // (o GPT às vezes omite o "novo nome:").
    const m = line.match(/^RENOMEAR:\s*(.+?)\s*→\s*(?:novo nome:\s*)?(.+?)\s*$/)
    if (!m) return
    const act = findActivityByName(stripBrackets(m[1]), byName, activities)
    if (!act) return
    const novoNome = stripBrackets(m[2])
    if (!novoNome) return
    out.push({ id: act.id, name: novoNome })
  })
  return out
}
// DESLIGAR: [etapa] → remove depende de: [predecessora]
// Remove UMA dependência específica sem mexer nas outras da mesma etapa —
// diferente de LIGAR, que substitui a lista inteira. Permite a IA "barrar"
// (desfazer) uma conexão pontual que o usuário pediu pra desfazer.
function parseDesligarDirectives(text, activities) {
  const byName = buildActByNameIndex(activities)
  const out = []
  text.split('\n').forEach(line => {
    const m = line.match(/^DESLIGAR:\s*(.+?)\s*→\s*remove depende de:\s*(.+?)\s*$/)
    if (!m) return
    const act = findActivityByName(stripBrackets(m[1]), byName, activities)
    const pred = findActivityByName(stripBrackets(m[2]), byName, activities)
    if (!act || !pred) return
    out.push({ id: act.id, removeId: pred.id, removeName: pred.name })
  })
  return out
}
function stripDirectiveLines(text) {
  return text.split('\n').filter(l => !/^LIGAR:/.test(l) && !/^PRAZO:/.test(l) && !/^RENOMEAR:/.test(l) && !/^DESLIGAR:/.test(l)).join('\n').trim()
}

// Descreve em português, linha a linha, o que cada diretiva da IA vai mudar
// — mostrado ANTES de aplicar, pra pedir confirmação do usuário.
function buildChangeDescriptions(ligar, prazo, renomear, desligar, activities) {
  const byId = Object.fromEntries(activities.map(a => [a.id, a]))
  const lines = []
  renomear.forEach(({ id, name }) => {
    lines.push(`✏️ "${byId[id]?.name || '?'}" → novo nome: "${name}"`)
  })
  ;(desligar || []).forEach(({ id, removeName }) => {
    lines.push(`🚫 "${byId[id]?.name || '?'}" → remove a dependência de "${removeName}"`)
  })
  ligar.forEach(({ id, predecessor_ids }) => {
    const nome = byId[id]?.name || '?'
    const preds = (predecessor_ids || []).map(pid => byId[pid]?.name).filter(Boolean)
    lines.push(`🔗 "${nome}" → depende de: ${preds.length ? preds.join(', ') : 'nenhuma'}`)
  })
  prazo.forEach(({ id, week_start, week_end }) => {
    const nome = byId[id]?.name || '?'
    lines.push(`📅 "${nome}" → semana ${week_start}–${week_end}`)
  })
  return lines
}

// ─── Painel de IA do fluxograma ──────────────────────────────────────────────
// Flutua no canto da tela (igual um widget de chat), nunca ocupando a largura
// inteira. Toda alteração no cronograma (LIGAR/PRAZO/RENOMEAR) é proposta
// primeiro — o usuário vê exatamente o que vai mudar e precisa confirmar —
// e, uma vez aplicada, o próprio fluxograma destaca (e centraliza a vista
// n)as etapas alteradas, mostrando onde a mudança aconteceu.
function AIFluxoPanel({ project, activities, currentWeek, isMobile, aiLogs = [], onSaveAiLog, onApplyDirectives, onHighlight, onClose }) {
  // Carrega a conversa salva (ai_logs com source='fluxograma') pra IA lembrar
  // dos pedidos anteriores mesmo depois de fechar e reabrir o painel.
  const [history, setHistory] = useState(() => {
    const relevant = (aiLogs || [])
      .filter(l => l.source === 'fluxograma')
      .slice()
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    const msgs = []
    relevant.forEach(l => {
      if (l.user_question) msgs.push({ role: 'user', content: l.user_question })
      if (l.ai_response) msgs.push({ role: 'assistant', content: l.ai_response })
    })
    return msgs
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [applied, setApplied] = useState(0)

  async function send(message) {
    const msg = message || input
    if (!msg.trim() || loading) return
    setInput('')
    setError('')
    setHistory(h => [...h, { role: 'user', content: msg }])
    setLoading(true)
    try {
      const resposta = await analisarFluxo({
        obra: { nome: project?.name || 'Obra' },
        atividades: activities,
        mensagem: msg,
        historico: history,
      })
      if (!resposta || !resposta.trim()) {
        throw new Error('A IA não retornou uma resposta. Tente novamente.')
      }
      const ligarRaw = parseLigarDirectives(resposta, activities)
      const prazo = parsePrazoDirectives(resposta, activities)
      const renomear = parseRenomearDirectives(resposta, activities)
      const desligar = parseDesligarDirectives(resposta, activities)
      // Se a resposta inteira era só linha(s) de diretiva (comum quando o
      // pedido é curto, tipo "ajuste os nomes"), stripDirectiveLines pode
      // zerar o texto — nesse caso mostramos uma frase padrão em vez de
      // deixar o balão do chat em branco (parecia a IA travada).
      // DESLIGAR vira um LIGAR pontual (predecessor_ids atual menos a removida)
      // pra reaproveitar a mesma aplicação no banco — sem mexer nas outras
      // dependências da etapa. Se já existe um LIGAR explícito pra mesma
      // etapa, ele manda (é a lista completa e definitiva).
      const ligarIds = new Set(ligarRaw.map(x => x.id))
      const byIdAtual = Object.fromEntries(activities.map(a => [a.id, a]))
      const desligarAsLigar = desligar
        .filter(d => !ligarIds.has(d.id))
        .map(d => ({ id: d.id, predecessor_ids: (byIdAtual[d.id]?.predecessor_ids || []).filter(pid => pid !== d.removeId) }))
      const ligarForDb = [...ligarRaw, ...desligarAsLigar]
      const hasChanges = ligarForDb.length > 0 || prazo.length > 0 || renomear.length > 0
      const cleanText = stripDirectiveLines(resposta) || (hasChanges ? 'Ok, segue a alteração proposta:' : resposta.trim())
      if (hasChanges) {
        const descriptions = buildChangeDescriptions(ligarRaw, prazo, renomear, desligar, activities)
        setHistory(h => [...h, { role: 'assistant', content: cleanText, pendingChange: { ligar: ligarForDb, prazo, renomear, descriptions } }])
      } else {
        setHistory(h => [...h, { role: 'assistant', content: cleanText }])
      }
      onSaveAiLog?.({ week: currentWeek || null, user_question: msg, ai_response: cleanText, source: 'fluxograma' })
    } catch (err) {
      setError(err.message || 'Erro ao consultar a IA.')
    } finally {
      setLoading(false)
    }
  }

  async function confirmChange(idx) {
    const msg = history[idx]
    if (!msg?.pendingChange || !onApplyDirectives) return
    setHistory(h => h.map((m, i) => i === idx ? { ...m, resolving: true } : m))
    const { ligar, prazo, renomear } = msg.pendingChange
    const r = await onApplyDirectives(ligar, prazo, renomear)
    const appliedCount = r?.applied || 0
    if (appliedCount) setApplied(a => a + appliedCount)
    onHighlight?.(r?.changedIds || [])
    setHistory(h => h.map((m, i) => i === idx ? { ...m, resolving: false, resolved: 'applied', appliedNames: r?.changedNames || [] } : m))
  }

  function cancelChange(idx) {
    setHistory(h => h.map((m, i) => i === idx ? { ...m, resolved: 'cancelled' } : m))
  }

  return (
    <div style={{
      position: 'absolute', zIndex: 30,
      right: isMobile ? 12 : 20, left: isMobile ? 12 : 'auto',
      bottom: isMobile ? 84 : 86,
      width: isMobile ? 'auto' : 380,
      maxHeight: 'min(70vh, 560px)',
      background: C.white, borderRadius: 16, border: `1px solid ${C.gray200}`,
      boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
      display: 'flex', flexDirection: 'column', fontFamily: FONT_BODY, overflow: 'hidden',
    }}>
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.gray200}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="chat" size={16} color={C.orange} />
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 14, color: C.black }}>IA DO FLUXOGRAMA</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gray500 }}>
          <Icon name="x" size={18} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 160 }}>
        {history.length === 0 && (
          <div style={{ fontSize: 13, color: C.gray500 }}>
            Sou um agente ativo: posso conectar etapas soltas e ajustar prazos incoerentes direto na rede — sempre te mostrando o que vai mudar antes, e pedindo confirmação. Pergunte algo ou use "Reorganizar tudo" pra eu revisar o fluxograma inteiro.
          </div>
        )}
        {history.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '90%', padding: '8px 12px', borderRadius: 10,
            background: m.role === 'user' ? C.orange : C.gray100,
            color: m.role === 'user' ? C.white : C.black,
            fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap',
          }}>
            {m.content}

            {m.pendingChange && !m.resolved && (
              <div style={{ marginTop: 8, padding: '8px 10px', background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, color: C.black }}>Alterações propostas no cronograma:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 8 }}>
                  {m.pendingChange.descriptions.map((d, di) => (
                    <div key={di} style={{ fontSize: 11, color: C.gray700 }}>{d}</div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Btn size="sm" icon="check" onClick={() => confirmChange(i)} disabled={m.resolving}>
                    {m.resolving ? 'Aplicando...' : 'Confirmar'}
                  </Btn>
                  <Btn size="sm" variant="secondary" onClick={() => cancelChange(i)} disabled={m.resolving}>Cancelar</Btn>
                </div>
              </div>
            )}
            {m.resolved === 'applied' && (
              <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(255,255,255,0.5)', borderRadius: 6, fontSize: 11, fontWeight: 700, color: C.orange }}>
                ✓ Alterado no fluxograma{m.appliedNames?.length ? `: ${m.appliedNames.join(', ')}` : ''}
              </div>
            )}
            {m.resolved === 'cancelled' && (
              <div style={{ marginTop: 8, fontSize: 11, color: C.gray500 }}>✗ Alteração cancelada — nada foi mudado.</div>
            )}
          </div>
        ))}
        {loading && <Spinner />}
        {error && <Alert type="error">{error}</Alert>}
      </div>

      <div style={{ padding: '0 12px 8px', fontSize: 10, color: C.gray400, flexShrink: 0 }}>
        {applied > 0 && `${applied} alteração(ões) aplicada(s) nesta sessão`}
      </div>
      <div style={{ padding: 12, borderTop: `1px solid ${C.gray200}`, display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
        <Btn size="sm" variant="secondary" onClick={() => send('Reorganize completamente o fluxograma: defina a predecessora correta de cada etapa (sequência real de construção) e ajuste as semanas de início/fim de todas para não haver sobreposição ilógica. Gere LIGAR e PRAZO para TODAS as etapas, mesmo as que já estão certas.')} disabled={loading}>🔄 Reorganizar tudo</Btn>
        <Btn size="sm" variant="secondary" onClick={() => send('Qual o andamento geral e o que está travado?')} disabled={loading}>Andamento</Btn>
        <Btn size="sm" variant="secondary" onClick={() => send('Quais os próximos passos recomendados?')} disabled={loading}>Próximos passos</Btn>
        <div style={{ display: 'flex', gap: 8, width: '100%' }}>
          <Input style={{ flex: 1 }} placeholder="Pergunte à IA..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} />
          <Btn size="sm" icon="send" onClick={() => send()} disabled={loading} />
        </div>
      </div>
    </div>
  )
}
