import { useState, useRef, useEffect } from 'react'
import { C, FONT_BODY, FONT_DISPLAY, TIPO_CFG, GRUPOS_PADRAO } from '../tokens'
import { Btn, Icon } from '../components/ui'
import AIScheduleBuilder from './AIScheduleBuilder'
import { getWeekDates, formatDateBR } from '../components/Gantt'
import HardHatIcon from '../components/HardHatIcon'
import TractorIcon from '../components/TractorIcon'
import { fetchActivityDocs, uploadActivityDoc, getActivityDocUrl, deleteActivityDoc } from '../lib/supabase'
import { callAI } from '../lib/ai'

// Returns array of week calendar objects: { week, mon, tue, wed, thu, fri }
function buildWeekCalendar(startDate, weeks) {
  const result = []
  for (let w = 1; w <= weeks; w++) {
    const dates = startDate ? getWeekDates(startDate, w) : null
    if (dates) {
      const mon = new Date(dates.start)
      const fri = new Date(dates.start)
      fri.setDate(mon.getDate() + 4) // Friday = Mon + 4
      result.push({
        week: w,
        monDate: mon,
        friDate: fri,
        label: `${formatDateBR(mon)} (seg) → ${formatDateBR(fri)} (sex)`,
      })
    } else {
      result.push({ week: w, monDate: null, friDate: null, label: `Semana ${w}` })
    }
  }
  return result
}

const STATUS_OPTIONS = [
  { value: 'nao_iniciado', label: 'Não iniciado' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'concluido',    label: 'Concluído'    },
  { value: 'atrasado',     label: 'Atrasado'     },
  { value: 'suspenso',     label: 'Suspenso'     },
]

const STATUS_COLORS = {
  nao_iniciado: { bg: C.gray100,    cor: C.gray500 },
  em_andamento: { bg: C.amberLight, cor: C.amber   },
  concluido:    { bg: C.greenLight, cor: C.green   },
  atrasado:     { bg: C.redLight,   cor: C.red     },
  suspenso:     { bg: C.amberLight, cor: C.amber   },
}

const DISCIPLINAS = [
  'Arquitetura', 'Estrutural', 'Hidrossanitário', 'Elétrico', 'CFTV',
  'Pavimentação', 'Drenagem', 'Terraplenagem', 'Topografia', 'Ambiental', 'Geral',
]

const DOC_COLOR = C.orange
const DOC_LIGHT = C.orangeLight

// grip | workers | equipment | docs | name | tipo | start | end | ia | avanço | status | observações | del
const COLS  = '20px 28px 28px 28px minmax(240px,2fr) 110px 64px 64px 28px 160px 120px minmax(180px,1fr) 32px'
const MIN_W = 1180

const PROFISSOES = [
  'Mestre de Obra', 'Encarregado', 'Servente', 'Pedreiro', 'Armador',
  'Betoneiro', 'Carpinteiro', 'Bloqueiro', 'Marceneiro',
  'Eletricista', 'Encanador', 'Pintor', 'Azulejista', 'Gesseiro',
]

const EQUIPAMENTOS = [
  'Matelete',
  'Martelete de Impacto',
  'Martelo',
  'Marreta',
  'Picareta',
  'Pá',
  'Enxada',
  'Ciscador',
  'Parafusadeira/Furadeira',
  'Máquina de Solda',
  'Vibrador de Concreto',
  'Betoneira',
  'Retroescavadeira',
  'Motoniveladora',
  'Pá Carregadeira',
  'PC',
  'Caçamba',
  'Andaime',
  'Escoras',
  'Peneira',
  'Carrinho de Mão',
  'Perfurador de Solo',
  'Mangueira de Água',
  'Mangueira de Nível',
  'Estação Total',
  'Nível Topográfico',
  'GPS RTK',
  'Drone',
  'Balde',
]

function genUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

function groupActivities(activities) {
  const groups = {}
  activities.forEach(a => {
    const g = a.group_name || 'Geral'
    if (!groups[g]) groups[g] = []
    groups[g].push(a)
  })
  return groups
}

/* ── POPUP "ATRASADO" ─────────────────────────────────── */
function AtrasadoPopup({ initialObs = '', onConfirm, onCancel }) {
  const [obs, setObs] = useState(initialObs)
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 2000, padding: 16,
    }}>
      <div style={{
        background: C.white, borderRadius: 12, width: '100%', maxWidth: 440,
        fontFamily: FONT_BODY, overflow: 'hidden',
        boxShadow: '0 16px 48px rgba(0,0,0,0.28)',
      }}>
        <div style={{
          padding: '14px 20px', background: C.redLight,
          borderBottom: `1px solid ${C.red}`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Icon name="warning" size={18} color={C.red} />
          <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: C.red, letterSpacing: '0.04em' }}>
            MOTIVO DO ATRASO
          </span>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <p style={{ fontSize: 13, color: C.gray700, marginBottom: 12, lineHeight: 1.5 }}>
            Descreva o motivo do atraso. Aparecerá na coluna Observações.
          </p>
          <textarea
            autoFocus
            value={obs}
            onChange={e => setObs(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && e.ctrlKey && onConfirm(obs)}
            placeholder="Ex: Chuvas, falta de material, atraso de fornecedor..."
            rows={3}
            style={{
              width: '100%', boxSizing: 'border-box',
              fontFamily: FONT_BODY, fontSize: 13,
              padding: '10px 12px', border: `1.5px solid ${C.red}`,
              borderRadius: 7, outline: 'none', resize: 'vertical',
              color: C.black, background: C.white,
            }}
          />
          <p style={{ fontSize: 11, color: C.gray500, marginTop: 6 }}>Ctrl+Enter para confirmar</p>
        </div>
        <div style={{
          padding: '10px 20px', display: 'flex', gap: 8,
          justifyContent: 'flex-end', borderTop: `1px solid ${C.gray200}`,
          background: C.gray50,
        }}>
          <Btn variant="ghost" size="sm" onClick={onCancel}>Cancelar</Btn>
          <Btn variant="danger" size="sm" icon="warning" onClick={() => onConfirm(obs)}>
            Confirmar atraso
          </Btn>
        </div>
      </div>
    </div>
  )
}

/* ── ACTIVITY AI MODAL ───────────────────────────────── */
function ActivityAIModal({ actName, actTipo, weekStart, weekEnd, currentWorkers, currentEquipment, onSave, onClose }) {
  const [desc,    setDesc]    = useState('')
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState(null)   // { workers: [], equipment: [] }
  const [confirm, setConfirm] = useState(false)
  const [error,   setError]   = useState('')

  async function handleProcess(useDefault) {
    setLoading(true); setError(''); setResult(null)
    try {
      const userMsg = useDefault
        ? `Serviço: ${actName}. Tipo: ${actTipo}. Semanas: S${weekStart} a S${weekEnd}. Preencha com equipe e equipamentos típicos para esta atividade de construção civil.`
        : `Serviço: ${actName}. Tipo: ${actTipo}. Semanas: S${weekStart} a S${weekEnd}.\nDetalhes: ${desc}`

      const system = `Você é um engenheiro sênior de obras civis especialista em planejamento de mão de obra e equipamentos.
Com base na atividade descrita, sugira os profissionais e equipamentos necessários com quantidades realistas.

Normas Leonette Engenharia:
- Concreto: sempre dosado em obra com betoneira. Cimento CP-II-F-32.
- Ferragem: gaiolas pré-armadas pelo fornecedor.
- Equipamentos: vibradores de imersão, betoneiras, compactadores, escavadeiras, etc.

Profissionais disponíveis: ${PROFISSOES.join(', ')}
Equipamentos disponíveis: ${EQUIPAMENTOS.join(', ')}

Responda APENAS com JSON puro, sem markdown:
{
  "workers": [{"role": "nome exato da lista", "qty": 2}],
  "equipment": [{"name": "nome exato da lista", "qty": 1}]
}

Regras:
- Use APENAS nomes exatos das listas acima
- Quantidades realistas para 1 semana de trabalho
- workers e equipment podem ser arrays vazios se não houver necessidade
- Máximo 6 profissionais e 4 equipamentos`

      const resp = await callAI({ system, messages: [{ role: 'user', content: userMsg }], max_tokens: 400 })
      const clean = resp.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim()
      const parsed = JSON.parse(clean)
      if (!parsed.workers && !parsed.equipment) throw new Error('Resposta inválida')
      setResult({
        workers:   Array.isArray(parsed.workers)   ? parsed.workers.filter(w => w.qty > 0)   : [],
        equipment: Array.isArray(parsed.equipment) ? parsed.equipment.filter(e => e.qty > 0) : [],
      })
    } catch(err) {
      setError('Erro: ' + (err.message || 'resposta inesperada'))
    } finally { setLoading(false) }
  }

  function handleSaveClick() {
    setConfirm(true)
  }

  function handleConfirm() {
    onSave(result)
    onClose()
  }

  const RobotIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M12 2a3 3 0 0 1 3 3v2a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
      <line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/>
      <line x1="12" y1="11" x2="12" y2="7"/>
    </svg>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2100, padding: 16 }}>
      <div style={{ background: C.white, borderRadius: 14, width: '100%', maxWidth: 520, fontFamily: FONT_BODY, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
        {/* Header */}
        <div style={{ padding: '14px 20px', background: C.surface, borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: C.orange, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
            <RobotIcon />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: C.onSurface, letterSpacing: '0.04em' }}>PLANEJAMENTO IA</div>
            <div style={{ fontSize: 11, color: C.onSurfaceMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{actName}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.onSurfaceMuted, fontSize: 22, lineHeight: 1, padding: 4 }}>×</button>
        </div>

        <div style={{ padding: '18px 20px' }}>
          {!confirm ? (
            <>
              {/* Input */}
              <textarea
                value={desc}
                onChange={e => { setDesc(e.target.value); setResult(null); setError('') }}
                placeholder={`Descreva os detalhes do serviço ou deixe em branco para processamento padrão.\n\nEx: "Concretagem de sapatas com concreto C-25 dosado em obra, 4 sapatas de 1.5m³ cada, acesso restrito"`}
                rows={4}
                style={{ width: '100%', boxSizing: 'border-box', fontFamily: FONT_BODY, fontSize: 13, padding: '12px 14px', borderRadius: 8, border: `1.5px solid ${C.gray200}`, background: C.gray50, color: C.gray900, resize: 'vertical', outline: 'none', lineHeight: 1.6, marginBottom: 12 }}
              />
              <div style={{ display: 'flex', gap: 8, marginBottom: result ? 16 : 0 }}>
                <Btn variant="secondary" size="sm" onClick={() => handleProcess(true)} disabled={loading}>
                  ⚡ Processamento padrão
                </Btn>
                <Btn variant="primary" size="sm" onClick={() => handleProcess(false)} disabled={loading || !desc.trim()}>
                  {loading ? 'Processando...' : '🤖 Processar com detalhes'}
                </Btn>
              </div>

              {error && <div style={{ marginTop: 10, padding: '8px 12px', background: C.redLight, borderRadius: 7, fontSize: 12, color: C.red }}>{error}</div>}

              {/* Preview result */}
              {result && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.gray500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Sugestão da IA:</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                    {/* Workers */}
                    <div style={{ background: C.orangeLight, border: `1px solid ${C.orange}`, borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.orange, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>👷 Profissionais</div>
                      {result.workers.length === 0
                        ? <div style={{ fontSize: 12, color: C.gray500 }}>Nenhum</div>
                        : result.workers.map((w, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.black, marginBottom: 4 }}>
                            <span>{w.role}</span>
                            <span style={{ fontWeight: 700, color: C.orange }}>{w.qty}x</span>
                          </div>
                        ))
                      }
                    </div>
                    {/* Equipment */}
                    <div style={{ background: C.blueLight, border: `1px solid ${C.blue}`, borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.blue, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>🔧 Equipamentos</div>
                      {result.equipment.length === 0
                        ? <div style={{ fontSize: 12, color: C.gray500 }}>Nenhum</div>
                        : result.equipment.map((e, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.black, marginBottom: 4 }}>
                            <span>{e.name}</span>
                            <span style={{ fontWeight: 700, color: C.blue }}>{e.qty}x</span>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Confirm screen */
            <div style={{ textAlign: 'center', padding: '10px 0 6px' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>⚠️</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: C.black, marginBottom: 8 }}>Confirmar alterações?</div>
              <div style={{ fontSize: 13, color: C.gray500, marginBottom: 16, lineHeight: 1.5 }}>
                A IA vai sobrescrever os profissionais e equipamentos atuais desta atividade.
                <br /><strong style={{ color: C.black }}>Esta ação não pode ser desfeita sem salvar manualmente.</strong>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <Btn variant="secondary" size="sm" onClick={() => setConfirm(false)}>Voltar</Btn>
                <Btn variant="primary" size="sm" icon="check" onClick={handleConfirm}>Sim, aplicar</Btn>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!confirm && result && (
          <div style={{ padding: '12px 20px 16px', display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: `1px solid ${C.gray100}` }}>
            <Btn variant="ghost" size="sm" onClick={onClose}>Cancelar</Btn>
            <Btn variant="secondary" size="sm" onClick={() => setResult(null)}>Refazer</Btn>
            <Btn variant="primary" size="sm" icon="check" onClick={handleSaveClick}>Salvar na atividade</Btn>
          </div>
        )}
        {!confirm && !result && (
          <div style={{ padding: '12px 20px 16px', display: 'flex', justifyContent: 'flex-end', borderTop: `1px solid ${C.gray100}` }}>
            <Btn variant="ghost" size="sm" onClick={onClose}>Fechar</Btn>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── WORKERS MODAL ───────────────────────────────────── */
function WorkersModal({ actName, workers = [], onSave, onClose }) {
  const [qtds, setQtds] = useState(() => {
    const map = {}
    workers.forEach(w => { map[w.role] = w.qty })
    return PROFISSOES.reduce((acc, r) => { acc[r] = map[r] ?? 0; return acc }, {})
  })

  function handleSave() {
    const result = PROFISSOES.filter(r => qtds[r] > 0).map(r => ({ role: r, qty: qtds[r] }))
    onSave(result)
  }

  const total = PROFISSOES.reduce((s, r) => s + (qtds[r] || 0), 0)

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 2000, padding: 16,
    }}>
      <div style={{
        background: C.white, borderRadius: 12, width: '100%', maxWidth: 400,
        fontFamily: FONT_BODY, overflow: 'hidden',
        boxShadow: '0 16px 48px rgba(0,0,0,0.28)',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 20px',
          background: C.amberLight,
          borderBottom: `1px solid ${C.amber}`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <HardHatIcon size={24} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: C.amber, letterSpacing: '0.04em' }}>
              EQUIPE DA ATIVIDADE
            </div>
            <div style={{ fontSize: 11, color: C.gray700, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 300 }}>
              {actName || 'Atividade'}
            </div>
          </div>
        </div>

        {/* Body — professions list */}
        <div style={{ padding: '16px 20px', maxHeight: 380, overflowY: 'auto' }}>
          {/* Column headers */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${C.gray200}` }}>
            <div style={{ width: 64, fontSize: 10, fontWeight: 700, color: C.gray500, letterSpacing: '0.06em', textAlign: 'center' }}>QTD</div>
            <div style={{ flex: 1, fontSize: 10, fontWeight: 700, color: C.gray500, letterSpacing: '0.06em' }}>PROFISSIONAL</div>
          </div>
          {PROFISSOES.map(role => (
            <div key={role} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <input
                type="number"
                min={0} max={99}
                value={qtds[role]}
                onChange={e => setQtds(q => ({ ...q, [role]: Math.max(0, parseInt(e.target.value) || 0) }))}
                style={{
                  width: 64, flexShrink: 0,
                  fontFamily: FONT_BODY, fontSize: 15, fontWeight: 700,
                  padding: '6px 8px', textAlign: 'center',
                  border: `1.5px solid ${qtds[role] > 0 ? C.orange : C.gray200}`,
                  borderRadius: 6, outline: 'none',
                  background: qtds[role] > 0 ? C.orangeLight : C.white,
                  color: qtds[role] > 0 ? C.orange : C.black,
                  boxSizing: 'border-box',
                }}
              />
              <span style={{
                flex: 1, fontSize: 13,
                color: qtds[role] > 0 ? C.black : C.gray500,
                fontWeight: qtds[role] > 0 ? 600 : 400,
              }}>
                {role}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderTop: `1px solid ${C.gray200}`, background: C.gray50, gap: 8,
        }}>
          <span style={{ fontSize: 12, color: C.gray500 }}>
            {total > 0 ? `${total} profissional${total !== 1 ? 'is' : ''}` : 'Nenhum selecionado'}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" size="sm" onClick={onClose}>Cancelar</Btn>
            <Btn variant="primary" size="sm" icon="check" onClick={handleSave}>Salvar equipe</Btn>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── EQUIPMENT MODAL ─────────────────────────────────── */
// normalize: suporta formato antigo string[] e novo {name,qty}[]
function normalizeEquipment(eq) {
  if (!Array.isArray(eq)) return []
  return eq.map(e => typeof e === 'string' ? { name: e, qty: 1 } : e)
}
function eqLabel(e) {
  if (!e) return ''
  return typeof e === 'string' ? e : (e.qty > 1 ? `${e.qty}x ${e.name}` : e.name)
}

function EquipmentModal({ actName, equipment = [], onSave, onClose }) {
  const [qtds, setQtds] = useState(() => {
    const map = {}
    normalizeEquipment(equipment).forEach(e => { map[e.name] = e.qty || 1 })
    return map
  })

  function setQty(name, val) {
    const n = Math.max(0, parseInt(val) || 0)
    setQtds(prev => ({ ...prev, [name]: n }))
  }

  function handleSave() {
    const result = EQUIPAMENTOS
      .filter(name => (qtds[name] || 0) > 0)
      .map(name => ({ name, qty: qtds[name] }))
    onSave(result)
  }

  const total = EQUIPAMENTOS.reduce((s, n) => s + (qtds[n] || 0), 0)

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 2000, padding: 16,
    }}>
      <div style={{
        background: C.white, borderRadius: 12, width: '100%', maxWidth: 400,
        fontFamily: FONT_BODY, overflow: 'hidden',
        boxShadow: '0 16px 48px rgba(0,0,0,0.28)',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 20px',
          background: C.orangeLight,
          borderBottom: `1px solid ${C.orange}`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <TractorIcon size={24} color={C.orange} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: C.orange, letterSpacing: '0.04em' }}>
              EQUIPAMENTOS
            </div>
            <div style={{ fontSize: 11, color: C.gray700, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 300 }}>
              {actName || 'Atividade'}
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '12px 20px', maxHeight: 380, overflowY: 'auto' }}>
          {EQUIPAMENTOS.map(name => {
            const qty = qtds[name] || 0
            const on  = qty > 0
            return (
              <div key={name} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '8px 10px', marginBottom: 6,
                borderRadius: 8,
                background: on ? C.orangeLight : C.gray50,
                border: `1.5px solid ${on ? C.orange : C.gray200}`,
                transition: 'all 0.15s',
              }}>
                <TractorIcon size={16} color={on ? C.orange : C.gray300} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: on ? 600 : 400, color: on ? C.black : C.gray700 }}>
                  {name}
                </span>
                {/* Qty stepper */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: `1.5px solid ${on ? C.orange : C.gray300}`, borderRadius: 7, overflow: 'hidden' }}>
                  <button
                    onClick={() => setQty(name, qty - 1)}
                    style={{ width: 28, height: 28, border: 'none', background: on ? C.orange : C.gray100, color: on ? '#fff' : C.gray500, cursor: 'pointer', fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >−</button>
                  <input
                    type="number" min={0} value={qty}
                    onChange={e => setQty(name, e.target.value)}
                    style={{ width: 36, border: 'none', textAlign: 'center', fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: on ? C.orange : C.gray500, background: C.white, outline: 'none', padding: '0 2px' }}
                  />
                  <button
                    onClick={() => setQty(name, qty + 1)}
                    style={{ width: 28, height: 28, border: 'none', background: on ? C.orange : C.gray100, color: on ? '#fff' : C.gray500, cursor: 'pointer', fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >+</button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderTop: `1px solid ${C.gray200}`, background: C.gray50, gap: 8,
        }}>
          <span style={{ fontSize: 12, color: C.gray500 }}>
            {total > 0 ? `${total} unidade${total !== 1 ? 's' : ''} selecionada${total !== 1 ? 's' : ''}` : 'Nenhum selecionado'}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" size="sm" onClick={onClose}>Cancelar</Btn>
            <Btn variant="primary" size="sm" icon="check" onClick={handleSave}>Salvar</Btn>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── DOC ITEM ────────────────────────────────────────── */
function DocItem({ doc, allRevs, onDownload, onDelete }) {
  const [showRevs, setShowRevs] = useState(false)
  const revCount = allRevs.length
  const sizeKB = doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB` : ''
  return (
    <div style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 8, marginBottom: 6, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', gap: 10 }}>
        <div style={{ width: 32, height: 32, background: DOC_LIGHT, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="file" size={15} color={DOC_COLOR} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.black, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.doc_name}</div>
          <div style={{ fontSize: 11, color: C.gray500, marginTop: 1 }}>{doc.file_name}{sizeKB ? ` · ${sizeKB}` : ''}</div>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: DOC_COLOR, background: DOC_LIGHT, padding: '2px 7px', borderRadius: 4, flexShrink: 0 }}>
          Rev.{String(doc.revision).padStart(2, '0')}
        </span>
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <button onClick={() => onDownload(doc)} title="Abrir" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4 }}>
            <Icon name="download" size={14} color={DOC_COLOR} />
          </button>
          <button onClick={() => onDelete(doc)} title="Excluir" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4 }}>
            <Icon name="trash" size={13} color={C.red} />
          </button>
          {revCount > 1 && (
            <button onClick={() => setShowRevs(v => !v)} style={{ background: 'none', border: `1px solid ${C.gray200}`, cursor: 'pointer', padding: '2px 6px', borderRadius: 4, fontSize: 10, color: C.gray500, fontFamily: FONT_BODY }}>
              {revCount} rev{showRevs ? ' ▲' : ' ▼'}
            </button>
          )}
        </div>
      </div>
      {showRevs && revCount > 1 && (
        <div style={{ background: C.gray50, borderTop: `1px solid ${C.gray100}`, padding: '8px 12px' }}>
          {allRevs.filter(r => !r.is_current).map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12, borderBottom: `1px solid ${C.gray100}` }}>
              <span style={{ color: C.gray400, fontSize: 10, fontWeight: 700, minWidth: 40 }}>Rev.{String(r.revision).padStart(2, '0')}</span>
              <span style={{ color: C.gray500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.file_name}</span>
              <span style={{ color: C.gray400, fontSize: 11, flexShrink: 0 }}>{new Date(r.created_at).toLocaleDateString('pt-BR')}</span>
              <button onClick={() => onDownload(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0 }}>
                <Icon name="download" size={12} color={C.gray400} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── PROJECTS DOCS MODAL ─────────────────────────────── */
function ProjectDocsModal({ actName, activityId, projectId, userId, docNotes = '', onNotesChange, onClose }) {
  const [tab, setTab]           = useState('docs')
  const [docs, setDocs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadForm, setUploadForm] = useState(null)
  const [notes, setNotes]       = useState(docNotes)
  const [uploadErr, setUploadErr] = useState('')
  const fileRef = useRef()

  useEffect(() => { loadDocs() }, [activityId]) // eslint-disable-line

  async function loadDocs() {
    setLoading(true)
    const { data } = await fetchActivityDocs(activityId)
    setDocs(data || [])
    setLoading(false)
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const docName = file.name.replace(/\.[^/.]+$/, '')
    setUploadForm({ file, discipline: 'Arquitetura', docName })
    setUploadErr('')
    e.target.value = ''
  }

  async function handleUpload() {
    if (!uploadForm || !uploadForm.docName.trim()) return
    setUploading(true)
    setUploadErr('')
    const { error } = await uploadActivityDoc({
      activityId, projectId, userId,
      file: uploadForm.file,
      discipline: uploadForm.discipline,
      docName: uploadForm.docName.trim(),
    })
    setUploading(false)
    if (error) { setUploadErr(error.message || 'Erro ao enviar'); return }
    setUploadForm(null)
    await loadDocs()
  }

  async function handleDownload(doc) {
    const { data } = await getActivityDocUrl(doc.storage_path)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function handleDelete(doc) {
    if (!window.confirm(`Excluir "${doc.doc_name}" Rev.${String(doc.revision).padStart(2,'0')}?`)) return
    await deleteActivityDoc({ id: doc.id, storagePath: doc.storage_path })
    await loadDocs()
  }

  const currentDocs = docs.filter(d => d.is_current)
  const grouped = currentDocs.reduce((acc, d) => {
    if (!acc[d.discipline]) acc[d.discipline] = []
    acc[d.discipline].push(d)
    return acc
  }, {})

  const ACTION_STYLE = {
    insert:   { label: 'Inserido',   color: C.green },
    revision: { label: 'Revisado',   color: '#2E75B6' },
    delete:   { label: 'Excluído',   color: C.red },
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 16 }}>
      <div style={{ background: C.white, borderRadius: 12, width: '100%', maxWidth: 540, fontFamily: FONT_BODY, overflow: 'hidden', boxShadow: '0 16px 48px rgba(0,0,0,0.28)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '14px 20px', background: DOC_LIGHT, borderBottom: `1px solid ${DOC_COLOR}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={DOC_COLOR} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: DOC_COLOR, letterSpacing: '0.04em' }}>PROJETOS</div>
            <div style={{ fontSize: 11, color: C.gray700, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{actName || 'Atividade'}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.gray500} strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.gray200}`, background: C.gray50 }}>
          {[['docs','Documentos'],['log','Histórico'],['notas','Notas']].map(([k, lbl]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              flex: 1, padding: '10px 0', fontSize: 12, fontWeight: tab === k ? 700 : 400,
              color: tab === k ? DOC_COLOR : C.gray500,
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: tab === k ? `2px solid ${DOC_COLOR}` : '2px solid transparent',
              fontFamily: FONT_BODY, transition: 'color 0.15s',
            }}>{lbl}</button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

          {/* ── DOCUMENTOS ── */}
          {tab === 'docs' && (
            <>
              <input ref={fileRef} type="file" accept="*/*" onChange={handleFileSelect} style={{ display: 'none' }} />
              {uploadForm ? (
                <div style={{ background: DOC_LIGHT, border: `1.5px solid ${DOC_COLOR}`, borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: DOC_COLOR, marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    📎 {uploadForm.file.name}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, color: C.gray500, display: 'block', marginBottom: 4 }}>Disciplina</label>
                      <select value={uploadForm.discipline} onChange={e => setUploadForm(f => ({ ...f, discipline: e.target.value }))}
                        style={{ width: '100%', fontSize: 12, padding: '6px 8px', border: `1px solid ${C.gray200}`, borderRadius: 5, outline: 'none', background: C.white, color: C.gray900, fontFamily: FONT_BODY }}>
                        {DISCIPLINAS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: C.gray500, display: 'block', marginBottom: 4 }}>Nome do documento</label>
                      <input value={uploadForm.docName} onChange={e => setUploadForm(f => ({ ...f, docName: e.target.value }))}
                        style={{ width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '6px 8px', border: `1px solid ${C.gray200}`, borderRadius: 5, outline: 'none', background: C.white, color: C.gray900, fontFamily: FONT_BODY }} />
                    </div>
                  </div>
                  {uploadErr && <div style={{ color: C.red, fontSize: 12, marginBottom: 8 }}>{uploadErr}</div>}
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <Btn variant="ghost" size="sm" onClick={() => setUploadForm(null)}>Cancelar</Btn>
                    <Btn variant="primary" size="sm" icon="upload" onClick={handleUpload} disabled={uploading}>
                      {uploading ? 'Enviando...' : 'Enviar'}
                    </Btn>
                  </div>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()} style={{
                  width: '100%', border: `2px dashed ${DOC_COLOR}`, borderRadius: 8,
                  background: DOC_LIGHT, padding: '14px', marginBottom: 14,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  color: DOC_COLOR, fontSize: 13, fontWeight: 600, fontFamily: FONT_BODY,
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={DOC_COLOR} strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  Adicionar documento / projeto
                </button>
              )}
              {loading ? (
                <div style={{ textAlign: 'center', color: C.gray400, padding: 20, fontSize: 13 }}>Carregando...</div>
              ) : Object.keys(grouped).length === 0 ? (
                <div style={{ textAlign: 'center', color: C.gray400, padding: 24, fontSize: 13 }}>Nenhum documento inserido nesta atividade</div>
              ) : Object.entries(grouped).map(([disc, items]) => (
                <div key={disc} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: DOC_COLOR, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, paddingLeft: 2 }}>
                    {disc}
                  </div>
                  {items.map(doc => (
                    <DocItem key={doc.id} doc={doc}
                      allRevs={docs.filter(d => d.discipline === doc.discipline && d.doc_name === doc.doc_name).sort((a,b) => b.revision - a.revision)}
                      onDownload={handleDownload} onDelete={handleDelete} />
                  ))}
                </div>
              ))}
            </>
          )}

          {/* ── HISTÓRICO ── */}
          {tab === 'log' && (
            loading ? (
              <div style={{ textAlign: 'center', color: C.gray400, padding: 20, fontSize: 13 }}>Carregando...</div>
            ) : docs.length === 0 ? (
              <div style={{ textAlign: 'center', color: C.gray400, padding: 24, fontSize: 13 }}>Sem histórico de alterações</div>
            ) : (
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 7, top: 8, bottom: 8, width: 2, background: C.gray100 }} />
                {docs.map(doc => {
                  const as = ACTION_STYLE[doc.action] || ACTION_STYLE.insert
                  return (
                    <div key={doc.id} style={{ display: 'flex', gap: 14, marginBottom: 10, position: 'relative' }}>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', background: as.color, flexShrink: 0, marginTop: 4, zIndex: 1, border: '2px solid white', boxShadow: `0 0 0 1px ${as.color}` }} />
                      <div style={{ flex: 1, background: C.gray50, borderRadius: 8, padding: '8px 12px', border: `1px solid ${C.gray100}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: as.color, background: `${as.color}22`, padding: '2px 6px', borderRadius: 4 }}>{as.label}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: DOC_COLOR, background: DOC_LIGHT, padding: '2px 6px', borderRadius: 4 }}>Rev.{String(doc.revision).padStart(2,'0')}</span>
                          <span style={{ fontSize: 11, color: C.gray500 }}>{doc.discipline}</span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.black }}>{doc.doc_name}</div>
                        <div style={{ fontSize: 11, color: C.gray500, marginTop: 3, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          <span>{doc.file_name}</span>
                          {doc.profiles?.name && <span>· {doc.profiles.name}</span>}
                          <span>· {new Date(doc.created_at).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          )}

          {/* ── NOTAS ── */}
          {tab === 'notas' && (
            <div>
              <p style={{ fontSize: 12, color: C.gray500, marginBottom: 10, lineHeight: 1.5 }}>
                Notas técnicas, pendências ou observações sobre os projetos desta atividade.
              </p>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Ex: Aguardando revisão da prancha estrutural. Solicitar ART ao responsável técnico..."
                rows={8}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  fontFamily: FONT_BODY, fontSize: 13,
                  padding: '10px 12px', border: `1.5px solid ${C.gray200}`,
                  borderRadius: 8, outline: 'none', resize: 'vertical',
                  color: C.black, background: C.white, lineHeight: 1.6,
                }}
              />
              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <Btn variant="ghost" size="sm" onClick={onClose}>Fechar</Btn>
                <Btn variant="primary" size="sm" icon="check" onClick={() => { onNotesChange(notes); onClose() }}>
                  Salvar Notas
                </Btn>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── ACTIVITY ROW ─────────────────────────────────────── */
function ActivityRow({ activity, weeks, onChange, onDelete, dragProps, currentWeek, projectId, userId }) {
  const [hovered, setHovered] = useState(false)
  const [showPopup, setShowPopup] = useState(false)
  const [showWorkers,     setShowWorkers]     = useState(false)
  const [showEquipment,   setShowEquipment]   = useState(false)
  const [showDocs,        setShowDocs]        = useState(false)
  const [showActivityAI,  setShowActivityAI]  = useState(false)
  const [docCount, setDocCount] = useState(0)

  // Load doc count on mount to show badge
  useEffect(() => {
    if (activity.id && !activity.id.startsWith('xx')) {
      fetchActivityDocs(activity.id).then(({ data }) => {
        setDocCount((data || []).filter(d => d.is_current).length)
      })
    }
  }, [activity.id]) // eslint-disable-line
  const sc = STATUS_COLORS[activity.status] || STATUS_COLORS.nao_iniciado
  const weekOptions = Array.from({ length: weeks }, (_, i) => i + 1)

  function update(field, value) {
    onChange({ ...activity, [field]: value })
  }

  function handleStatusChange(newStatus) {
    if (newStatus === 'concluido') {
      // Record the week in which completion was registered
      onChange({ ...activity, status: 'concluido', pct: 100, completed_week: currentWeek ?? null })
    } else if (newStatus === 'em_andamento') {
      // Auto-set week_start to currentWeek when starting an activity
      const updates = { status: 'em_andamento' }
      if (currentWeek && !activity.week_start) {
        updates.week_start = currentWeek
      }
      onChange({ ...activity, ...updates })
    } else if (newStatus === 'atrasado') {
      setShowPopup(true)
    } else {
      // Clearing concluido → remove completed_week
      update('status', newStatus)
      if (activity.status === 'concluido') {
        onChange({ ...activity, status: newStatus, completed_week: null })
        return
      }
    }
  }

  return (
    <>
      {showPopup && (
        <AtrasadoPopup
          initialObs={activity.observacoes || ''}
          onConfirm={obs => { onChange({ ...activity, status: 'atrasado', observacoes: obs }); setShowPopup(false) }}
          onCancel={() => setShowPopup(false)}
        />
      )}
      {showWorkers && (
        <WorkersModal
          actName={activity.name}
          workers={activity.workers || []}
          onSave={ws => { update('workers', ws); setShowWorkers(false) }}
          onClose={() => setShowWorkers(false)}
        />
      )}
      {showEquipment && (
        <EquipmentModal
          actName={activity.name}
          equipment={activity.equipment || []}
          onSave={eq => { update('equipment', eq); setShowEquipment(false) }}
          onClose={() => setShowEquipment(false)}
        />
      )}
      {showDocs && (
        <ProjectDocsModal
          actName={activity.name}
          activityId={activity.id}
          projectId={projectId}
          userId={userId}
          docNotes={activity.doc_notes || ''}
          onNotesChange={v => update('doc_notes', v)}
          onClose={() => { setShowDocs(false); fetchActivityDocs(activity.id).then(({ data }) => setDocCount((data||[]).filter(d=>d.is_current).length)) }}
        />
      )}
      {showActivityAI && (
        <ActivityAIModal
          actName={activity.name}
          actTipo={TIPO_CFG[activity.tipo]?.label || activity.tipo}
          weekStart={activity.week_start || 1}
          weekEnd={activity.week_end || 1}
          currentWorkers={activity.workers || []}
          currentEquipment={activity.equipment || []}
          onSave={({ workers, equipment }) => {
            onChange({ ...activity, workers, equipment })
            setShowActivityAI(false)
          }}
          onClose={() => setShowActivityAI(false)}
        />
      )}
      <div
        draggable
        onDragStart={dragProps?.onDragStart}
        onDragOver={dragProps?.onDragOver}
        onDrop={dragProps?.onDrop}
        onDragEnd={dragProps?.onDragEnd}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'grid',
          gridTemplateColumns: COLS,
          gap: 5,
          padding: '5px 10px',
          background: dragProps?.isOver ? C.orangeLight : hovered ? C.gray50 : C.white,
          borderBottom: `1px solid ${C.gray100}`,
          borderTop: dragProps?.isOver ? `2px solid ${C.orange}` : 'none',
          alignItems: 'center',
          opacity: dragProps?.isDragging ? 0.35 : 1,
          transition: 'background 0.1s',
          minWidth: MIN_W,
        }}
      >
        {/* Grip */}
        <div style={{ cursor: 'grab', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none' }}>
          <Icon name="grip" size={13} color={hovered ? C.gray400 : C.gray200} />
        </div>

        {/* Helmet — workers button */}
        <button
          onClick={() => setShowWorkers(true)}
          title={(activity.workers || []).length > 0
            ? (activity.workers || []).map(w => `${w.qty}x ${w.role}`).join(', ')
            : 'Definir equipe'}
          style={{
            background: (activity.workers || []).length > 0 ? C.orangeLight : 'none',
            border: (activity.workers || []).length > 0 ? `1.5px solid ${C.orange}` : `1px solid ${C.gray200}`,
            borderRadius: 5, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 24, height: 24, fontSize: 13, padding: 0,
            transition: 'all 0.15s',
          }}
        >
          <HardHatIcon size={15} color={(activity.workers || []).length > 0 ? C.orange : C.gray400} />
        </button>

        {/* Tractor — equipment button */}
        <button
          onClick={() => setShowEquipment(true)}
          title={normalizeEquipment(activity.equipment || []).filter(e => e.qty > 0).length > 0
            ? normalizeEquipment(activity.equipment || []).filter(e => e.qty > 0).map(eqLabel).join(', ')
            : 'Definir equipamentos'}
          style={{
            background: normalizeEquipment(activity.equipment || []).filter(e => e.qty > 0).length > 0 ? C.orangeLight : 'none',
            border: normalizeEquipment(activity.equipment || []).filter(e => e.qty > 0).length > 0 ? `1.5px solid ${C.orange}` : `1px solid ${C.gray200}`,
            borderRadius: 5, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 24, height: 24, padding: 0,
            transition: 'all 0.15s',
          }}
        >
          <TractorIcon size={15} color={normalizeEquipment(activity.equipment || []).filter(e => e.qty > 0).length > 0 ? C.orange : C.gray300} />
        </button>

        {/* Blueprint — docs/projects button */}
        <button
          onClick={() => setShowDocs(true)}
          title={docCount > 0 ? `${docCount} documento${docCount !== 1 ? 's' : ''} vinculado${docCount !== 1 ? 's' : ''}` : 'Vincular projetos/documentos'}
          style={{
            background: docCount > 0 ? DOC_LIGHT : 'none',
            border: docCount > 0 ? `1.5px solid ${DOC_COLOR}` : `1px solid ${C.gray200}`,
            borderRadius: 5, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 24, height: 24, padding: 0,
            transition: 'all 0.15s', position: 'relative',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={docCount > 0 ? DOC_COLOR : C.gray300} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          {docCount > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: -4,
              background: DOC_COLOR, color: '#fff',
              fontSize: 8, fontWeight: 700, fontFamily: FONT_BODY,
              borderRadius: '50%', width: 12, height: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1, userSelect: 'none',
            }}>{docCount}</span>
          )}
        </button>

        {/* Name — full width, no truncation */}
        <input
          value={activity.name || ''}
          onChange={e => update('name', e.target.value)}
          placeholder="Nome da atividade"
          style={{
            fontFamily: FONT_BODY, fontSize: 13,
            padding: '5px 8px',
            border: `1px solid ${hovered ? C.gray300 : C.gray200}`,
            borderRadius: 5, outline: 'none',
            color: C.black, background: 'transparent',
            width: '100%', boxSizing: 'border-box',
            minWidth: 0,
          }}
        />

        {/* Tipo */}
        <select
          value={activity.tipo || 'exec'}
          onChange={e => update('tipo', e.target.value)}
          style={{ fontFamily: FONT_BODY, fontSize: 12, padding: '5px 4px', border: `1px solid ${C.gray200}`, borderRadius: 5, outline: 'none', color: C.black, background: C.white, cursor: 'pointer', width: '100%' }}
        >
          {Object.entries(TIPO_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        {/* Week start */}
        <select
          value={activity.week_start || 1}
          onChange={e => {
            const v = Number(e.target.value)
            onChange({ ...activity, week_start: v, week_end: Math.max(v, activity.week_end || 1) })
          }}
          style={{ fontFamily: FONT_BODY, fontSize: 12, padding: '5px 2px', border: `1px solid ${C.gray200}`, borderRadius: 5, outline: 'none', color: C.black, background: C.white, cursor: 'pointer', width: '100%' }}
        >
          {weekOptions.map(w => <option key={w} value={w}>S{w}</option>)}
        </select>

        {/* Week end */}
        <select
          value={activity.week_end || 1}
          onChange={e => update('week_end', Number(e.target.value))}
          style={{ fontFamily: FONT_BODY, fontSize: 12, padding: '5px 2px', border: `1px solid ${C.gray200}`, borderRadius: 5, outline: 'none', color: C.black, background: C.white, cursor: 'pointer', width: '100%' }}
        >
          {weekOptions.filter(w => w >= (activity.week_start || 1)).map(w => <option key={w} value={w}>S{w}</option>)}
        </select>

        {/* IA robot button */}
        <button
          onClick={() => setShowActivityAI(true)}
          title="Planejamento IA — sugerir equipe e equipamentos"
          style={{
            width: 24, height: 24, borderRadius: 5, border: `1px solid ${C.orange}`,
            background: C.orangeLight, cursor: 'pointer', padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s', flexShrink: 0,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2"/>
            <path d="M12 2a3 3 0 0 1 3 3v2a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
            <line x1="8" y1="16" x2="8" y2="16"/>
            <line x1="16" y1="16" x2="16" y2="16"/>
            <line x1="12" y1="11" x2="12" y2="7"/>
          </svg>
        </button>

        {/* Avanço — slider + number, separate from status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="range" min={0} max={100} step={5}
            value={activity.pct ?? 0}
            onChange={e => update('pct', Number(e.target.value))}
            style={{ flex: 1, accentColor: C.orange, cursor: 'pointer', minWidth: 0 }}
          />
          <input
            type="number" min={0} max={100}
            value={activity.pct ?? 0}
            onChange={e => update('pct', Math.max(0, Math.min(100, Number(e.target.value))))}
            style={{ width: 36, fontFamily: FONT_BODY, fontSize: 12, padding: '3px 3px', border: `1px solid ${C.gray200}`, borderRadius: 4, textAlign: 'right', outline: 'none', color: C.black, background: C.white, flexShrink: 0 }}
          />
          <span style={{ fontSize: 10, color: C.gray500, flexShrink: 0 }}>%</span>
        </div>

        {/* Status — its own column, does NOT overlap Avanço */}
        <select
          value={activity.status || 'nao_iniciado'}
          onChange={e => handleStatusChange(e.target.value)}
          style={{ fontFamily: FONT_BODY, fontSize: 11, padding: '5px 4px', border: `1.5px solid ${sc.cor}`, borderRadius: 5, outline: 'none', color: sc.cor, background: sc.bg, cursor: 'pointer', fontWeight: 700, width: '100%' }}
        >
          {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        {/* Observações */}
        <input
          value={activity.observacoes || ''}
          onChange={e => update('observacoes', e.target.value)}
          onBlur={e => update('observacoes', e.target.value)}
          placeholder={activity.status === 'atrasado' ? '⚠ Motivo do atraso...' : 'Observação...'}
          style={{
            fontFamily: FONT_BODY, fontSize: 12,
            padding: '5px 8px',
            border: `1px solid ${activity.status === 'atrasado' ? C.red : (hovered ? C.gray300 : C.gray200)}`,
            borderRadius: 5, outline: 'none',
            color: activity.status === 'atrasado' ? C.red : C.black,
            background: activity.status === 'atrasado' ? C.redLight : 'transparent',
            width: '100%', boxSizing: 'border-box', minWidth: 0,
          }}
        />

        {/* Delete */}
        <button
          onClick={onDelete}
          title="Remover"
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, borderRadius: 4 }}
        >
          <Icon name="trash" size={14} color={hovered ? C.red : C.gray300} />
        </button>
      </div>
    </>
  )
}

/* ── ADD ROW ─────────────────────────────────────────── */
function AddActivityRow({ weeks, onAdd }) {
  const [form, setForm] = useState({ name: '', tipo: 'exec', week_start: 1, week_end: 1, pct: 0, status: 'nao_iniciado', observacoes: '' })
  const weekOptions = Array.from({ length: weeks }, (_, i) => i + 1)

  function handleAdd() {
    if (!form.name.trim()) return
    onAdd({ ...form, id: genUUID() })
    setForm({ name: '', tipo: 'exec', week_start: 1, week_end: 1, pct: 0, status: 'nao_iniciado', observacoes: '' })
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 5, padding: '7px 10px', background: C.orangeLight, borderTop: `1px dashed ${C.orange}`, alignItems: 'center', minWidth: MIN_W }}>
      <div />
      <div />
      <div />
      <div />
      <input
        value={form.name}
        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        onKeyDown={e => e.key === 'Enter' && handleAdd()}
        placeholder="Nova atividade..."
        style={{ fontFamily: FONT_BODY, fontSize: 13, padding: '5px 8px', border: `1px solid ${C.orange}`, borderRadius: 5, outline: 'none', color: C.black, background: C.white, width: '100%', boxSizing: 'border-box' }}
      />
      <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
        style={{ fontFamily: FONT_BODY, fontSize: 12, padding: '5px 4px', border: `1px solid ${C.gray200}`, borderRadius: 5, outline: 'none', color: C.black, background: C.white, width: '100%' }}>
        {Object.entries(TIPO_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </select>
      <select value={form.week_start} onChange={e => setForm(f => ({ ...f, week_start: Number(e.target.value) }))}
        style={{ fontFamily: FONT_BODY, fontSize: 12, padding: '5px 2px', border: `1px solid ${C.gray200}`, borderRadius: 5, outline: 'none', background: C.white, width: '100%' }}>
        {weekOptions.map(w => <option key={w} value={w}>S{w}</option>)}
      </select>
      <select value={form.week_end} onChange={e => setForm(f => ({ ...f, week_end: Number(e.target.value) }))}
        style={{ fontFamily: FONT_BODY, fontSize: 12, padding: '5px 2px', border: `1px solid ${C.gray200}`, borderRadius: 5, outline: 'none', background: C.white, width: '100%' }}>
        {weekOptions.filter(w => w >= form.week_start).map(w => <option key={w} value={w}>S{w}</option>)}
      </select>
      <div />{/* IA col placeholder */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input type="number" min={0} max={100} value={form.pct}
          onChange={e => setForm(f => ({ ...f, pct: Number(e.target.value) }))}
          style={{ width: 46, fontFamily: FONT_BODY, fontSize: 12, padding: '4px 4px', border: `1px solid ${C.gray200}`, borderRadius: 4, outline: 'none', textAlign: 'right', color: C.black, background: C.white }} />
        <span style={{ fontSize: 10, color: C.gray500 }}>%</span>
      </div>
      <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
        style={{ fontFamily: FONT_BODY, fontSize: 11, padding: '5px 4px', border: `1px solid ${C.gray200}`, borderRadius: 5, outline: 'none', background: C.white, width: '100%' }}>
        {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <input value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
        placeholder="Observação..."
        style={{ fontFamily: FONT_BODY, fontSize: 12, padding: '5px 8px', border: `1px solid ${C.gray200}`, borderRadius: 5, outline: 'none', color: C.black, background: C.white, width: '100%', boxSizing: 'border-box' }} />
      <button
        onClick={handleAdd}
        style={{ background: C.orange, border: 'none', borderRadius: 5, cursor: 'pointer', color: '#fff', fontWeight: 700, fontSize: 13, padding: '5px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        title="Adicionar"
      >
        <Icon name="plus" size={15} color="#fff" />
      </button>
    </div>
  )
}

/* ── MAIN ──────────────────────────────────────────────── */
export default function EditActivities({ activities = [], weeks = 20, onUpdate, startDate = null, currentWeek = null, projectId = null, userId = null }) {
  // LOCAL STATE — changes stay here until user hits Salvar
  const [local, setLocal] = useState(() => activities)
  const [isDirty, setIsDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const [newGroupName, setNewGroupName] = useState('')
  const [showAddGroup, setShowAddGroup] = useState(false)
  const [showAI, setShowAI] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)

  const weekCalendar = buildWeekCalendar(startDate, weeks)
  // currentWeek is passed as prop from Project (already computed from start_date)

  const dragSource = useRef(null)
  const dragTarget = useRef(null)
  const [dragOverId, setDragOverId] = useState(null)
  const [draggingId, setDraggingId] = useState(null)

  // Sync from parent only when NOT dirty (e.g. after parent loads data)
  useEffect(() => {
    if (!isDirty) setLocal(activities)
  }, [activities]) // eslint-disable-line

  function mutate(newActs) {
    setLocal(newActs)
    setIsDirty(true)
    setSaveMsg('')
  }

  async function handleSave() {
    setSaving(true)
    setSaveMsg('')
    try {
      await onUpdate(local)   // onUpdate in Project.jsx is async and awaits upsert
      setIsDirty(false)
      setSaveMsg('Salvo ✓')
      setTimeout(() => setSaveMsg(''), 3000)
    } catch {
      setSaveMsg('Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setLocal(activities)
    setIsDirty(false)
    setSaveMsg('')
  }

  // Drag & drop
  function handleDragStart(id) { dragSource.current = id; setDraggingId(id) }
  function handleDragOver(e, id) { e.preventDefault(); dragTarget.current = id; setDragOverId(id) }
  function handleDrop(e) {
    e.preventDefault()
    const si = local.findIndex(a => a.id === dragSource.current)
    const ti = local.findIndex(a => a.id === dragTarget.current)
    if (si === -1 || ti === -1 || si === ti) return
    const next = [...local]
    const [moved] = next.splice(si, 1)
    next.splice(ti, 0, moved)
    mutate(next)
  }
  function handleDragEnd() { dragSource.current = null; dragTarget.current = null; setDraggingId(null); setDragOverId(null) }

  const groups = groupActivities(local)
  const groupNames = Object.keys(groups)

  function handleChange(actId, updated) {
    mutate(local.map(a => a.id === actId ? updated : a))
  }

  function handleDelete(actId) {
    mutate(local.filter(a => a.id !== actId))
  }

  function handleAddToGroup(groupName, newAct) {
    mutate([...local, { ...newAct, group_name: groupName }])
  }

  function handleAddGroup() {
    if (!newGroupName.trim()) return
    mutate([...local, { id: genUUID(), name: '', group_name: newGroupName.trim(), tipo: 'exec', week_start: 1, week_end: 1, pct: 0, status: 'nao_iniciado', observacoes: '' }])
    setNewGroupName('')
    setShowAddGroup(false)
  }

  function handleAddDefaultGroups() {
    mutate([...local, ...GRUPOS_PADRAO.map(g => ({ id: genUUID(), name: '', group_name: g, tipo: 'exec', week_start: 1, week_end: 1, pct: 0, status: 'nao_iniciado', observacoes: '' }))])
  }

  const HEADER_COLS = ['', '', '', '', 'Atividade', 'Tipo', 'Início', 'Fim', '', 'Avanço', 'Status', 'Observações', '']
  const namedCount = local.filter(a => a.name && a.name.trim()).length

  return (
    <div style={{ fontFamily: FONT_BODY, minWidth: 0 }}>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 18, color: C.black, letterSpacing: '0.03em' }}>
          EDITOR DE ATIVIDADES
        </div>
        <span style={{ fontSize: 11, color: C.gray500, background: C.gray100, padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
          {namedCount} atividades
        </span>

        {/* Dirty indicator */}
        {isDirty && (
          <span style={{ fontSize: 11, color: C.amber, background: C.amberLight, padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
            ● Alterações não salvas
          </span>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {namedCount === 0 && (
            <Btn variant="secondary" size="sm" icon="refresh" onClick={handleAddDefaultGroups}>Usar grupos padrão</Btn>
          )}
          <Btn variant="primary" size="sm" icon="chat" onClick={() => setShowAI(true)}>Gerar com IA ✨</Btn>
          <Btn
            variant={showCalendar ? 'primary' : 'secondary'}
            size="sm"
            icon="calendar"
            onClick={() => setShowCalendar(s => !s)}
          >
            Calendário de semanas
          </Btn>
          <Btn variant="black" size="sm" icon="plus" onClick={() => setShowAddGroup(s => !s)}>Novo grupo</Btn>

          {/* Cancel */}
          {isDirty && (
            <Btn variant="ghost" size="sm" icon="close" onClick={handleCancel}>Cancelar</Btn>
          )}

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 18px', borderRadius: 7, border: 'none',
              fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13,
              cursor: isDirty && !saving ? 'pointer' : 'not-allowed',
              background: isDirty ? C.green : C.gray200,
              color: isDirty ? '#fff' : C.gray500,
              transition: 'background 0.2s, color 0.2s',
              boxShadow: isDirty ? '0 2px 8px rgba(34,197,94,0.3)' : 'none',
            }}
          >
            <Icon name="check" size={14} color={isDirty ? '#fff' : C.gray500} />
            {saving ? 'Salvando…' : 'Salvar'}
          </button>

          {/* Save status */}
          {saveMsg && (
            <span style={{
              fontSize: 12, fontWeight: 600,
              color: saveMsg.includes('Erro') ? C.red : C.green,
            }}>
              {saveMsg}
            </span>
          )}
        </div>
      </div>

      {/* Add group input */}
      {showAddGroup && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, padding: '12px 16px', background: C.gray50, borderRadius: 8, border: `1px solid ${C.gray200}` }}>
          <input
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddGroup()}
            placeholder="Nome do grupo / etapa"
            autoFocus
            style={{ flex: 1, maxWidth: 320, fontFamily: FONT_BODY, fontSize: 13, padding: '7px 10px', border: `1px solid ${C.gray300}`, borderRadius: 6, outline: 'none', color: C.black, background: C.white }}
          />
          <Btn variant="black" size="sm" onClick={handleAddGroup}>Criar grupo</Btn>
          <Btn variant="ghost" size="sm" onClick={() => setShowAddGroup(false)}>Cancelar</Btn>
        </div>
      )}

      {/* ── Calendário de semanas ── */}
      {showCalendar && (
        <div style={{
          marginBottom: 16,
          background: C.white,
          border: `1px solid ${C.gray200}`,
          borderRadius: 10,
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', background: C.surface,
          }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: '#EBEBEB', letterSpacing: '0.06em' }}>
              CALENDÁRIO DE SEMANAS
            </span>
            <span style={{ fontSize: 11, color: 'rgba(235,235,235,0.55)' }}>
              {startDate ? `Início: ${new Date(startDate + 'T12:00:00').toLocaleDateString('pt-BR')}` : 'Defina a data de início da obra para ver as datas'}
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 0 }}>
              {weekCalendar.map(({ week, monDate, friDate, label }) => {
                const isCurrent = week === currentWeek
                const isPast    = currentWeek !== null && week < currentWeek
                return (
                  <div key={week} style={{
                    padding: '8px 14px',
                    background: isCurrent ? C.orangeLight : 'transparent',
                    borderBottom: `1px solid ${C.gray100}`,
                    borderRight: `1px solid ${C.gray100}`,
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: isCurrent ? C.orange : isPast ? C.gray100 : C.gray50,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{
                        fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 14,
                        color: isCurrent ? '#fff' : isPast ? C.gray500 : C.black,
                      }}>
                        {week}
                      </span>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: isCurrent ? C.orange : C.black }}>
                        {monDate ? label : `Semana ${week}`}
                      </div>
                      {isCurrent && (
                        <div style={{ fontSize: 10, color: C.orange, fontWeight: 700, marginTop: 1 }}>
                          ← Semana atual
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          {!startDate && (
            <div style={{ padding: '12px 16px', background: C.amberLight, borderTop: `1px solid ${C.amber}`, fontSize: 12, color: C.amber, fontWeight: 600 }}>
              ⚠ Para ver as datas reais, defina a data de início da obra em "Minhas Obras" → Editar.
            </div>
          )}
        </div>
      )}

      {/* ── Table ── */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%', minWidth: 0, borderRadius: 8, border: local.length > 0 ? `1px solid ${C.gray200}` : 'none' }}>

        {/* Header */}
        {local.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 5, padding: '6px 10px', background: C.gray100, borderBottom: `1px solid ${C.gray200}`, minWidth: MIN_W }}>
            {HEADER_COLS.map((h, i) => (
              <div key={i} style={{ fontSize: 10, fontWeight: 700, color: C.gray500, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</div>
            ))}
          </div>
        )}

        <div>
          {/* Empty state */}
          {groupNames.length === 0 && (
            <div style={{ padding: '48px 24px', textAlign: 'center', background: C.white, border: `2px dashed ${C.gray200}`, borderRadius: 8 }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: C.gray500, marginBottom: 8 }}>NENHUMA ATIVIDADE CADASTRADA</div>
              <div style={{ color: C.gray500, fontSize: 13, marginBottom: 20 }}>Crie um grupo e adicione as atividades da obra.</div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <Btn variant="secondary" size="sm" icon="refresh" onClick={handleAddDefaultGroups}>Usar grupos padrão</Btn>
                <Btn variant="black" size="sm" icon="plus" onClick={() => setShowAddGroup(true)}>Novo grupo</Btn>
              </div>
            </div>
          )}

          {groupNames.map(groupName => {
            const groupActs = groups[groupName]
            const named = groupActs.filter(a => a.name && a.name.trim())
            const avgPct = named.length ? Math.round(named.reduce((s, a) => s + (a.pct || 0), 0) / named.length) : 0
            return (
              <div key={groupName}>
                {/* Group header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 14px', background: C.surface, minWidth: MIN_W }}>
                  <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.onSurface }}>
                    {groupName}
                  </span>
                  <span style={{ fontSize: 10, color: C.onSurfaceMuted, fontWeight: 600 }}>
                    {named.length} atividades · {avgPct}% médio
                  </span>
                </div>

                {/* Activity rows */}
                {groupActs.map((act, i) => (
                  act.name || groupActs.length > 1 ? (
                    <ActivityRow
                      key={act.id || i}
                      activity={act}
                      weeks={weeks}
                      currentWeek={currentWeek}
                      projectId={projectId}
                      userId={userId}
                      onChange={updated => handleChange(act.id, updated)}
                      onDelete={() => handleDelete(act.id)}
                      dragProps={{
                        isOver: dragOverId === act.id,
                        isDragging: draggingId === act.id,
                        onDragStart: () => handleDragStart(act.id),
                        onDragOver: e => handleDragOver(e, act.id),
                        onDrop: handleDrop,
                        onDragEnd: handleDragEnd,
                      }}
                    />
                  ) : null
                ))}

                <AddActivityRow weeks={weeks} onAdd={newAct => handleAddToGroup(groupName, newAct)} />
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer stats */}
      {namedCount > 0 && (
        <div style={{ display: 'flex', gap: 20, marginTop: 12, padding: '10px 16px', background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {Object.entries(local.filter(a => a.name).reduce((acc, a) => {
            const s = a.status || 'nao_iniciado'
            acc[s] = (acc[s] || 0) + 1
            return acc
          }, {})).map(([status, count]) => {
            const sc = STATUS_COLORS[status] || STATUS_COLORS.nao_iniciado
            const label = STATUS_OPTIONS.find(s => s.value === status)?.label || status
            return (
              <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: sc.cor }} />
                <span style={{ fontSize: 12, color: C.gray700 }}>{label}: <strong>{count}</strong></span>
              </div>
            )
          })}

          {/* Sticky save bar when dirty */}
          {isDirty && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: C.amber, fontWeight: 600 }}>Alterações não salvas</span>
              <Btn variant="ghost" size="sm" onClick={handleCancel}>Cancelar</Btn>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: C.green, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
              >
                {saving ? 'Salvando…' : '💾 Salvar agora'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* AI Builder */}
      {showAI && (
        <AIScheduleBuilder
          weeks={weeks}
          onAccept={newActs => {
            mutate([...local, ...newActs.map(a => ({ ...a, id: genUUID() }))])
            setShowAI(false)
          }}
          onClose={() => setShowAI(false)}
        />
      )}
    </div>
  )
}
