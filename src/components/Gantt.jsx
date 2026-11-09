import { useState, useCallback } from 'react'
import { C, FONT_BODY, FONT_DISPLAY, TIPO_CFG } from '../tokens'
import useIsMobile from '../hooks/useIsMobile'
import HardHatIcon from './HardHatIcon'
import TractorIcon from './TractorIcon'

function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = item[key] || 'Sem grupo'
    if (!acc[k]) acc[k] = []
    acc[k].push(item)
    return acc
  }, {})
}

// Returns the Monday of the week containing `date`
function getMondayOf(date) {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

// Returns {start: Date(Mon), end: Date(Sun)} for weekNum starting from startDate
export function getWeekDates(startDate, weekNum) {
  if (!startDate) return null
  const base = getMondayOf(new Date(startDate + 'T12:00:00'))
  const start = new Date(base)
  start.setDate(base.getDate() + (weekNum - 1) * 7)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return { start, end }
}

export function formatDateBR(date) {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function calcCurrentWeek(startDate) {
  if (!startDate) return 1
  const base = getMondayOf(new Date(startDate + 'T12:00:00'))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffMs = today - base
  if (diffMs < 0) return 1
  return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1
}

// Group weeks by calendar month for the header
function getMonthGroups(startDate, weeks) {
  const groups = []
  let current = null
  for (let w = 1; w <= weeks; w++) {
    const dates = startDate ? getWeekDates(startDate, w) : null
    const label = dates
      ? dates.start.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '').toUpperCase()
      : `Mês ${Math.ceil(w / 4)}`
    if (!current || current.label !== label) {
      current = { label, startW: w, endW: w }
      groups.push(current)
    } else {
      current.endW = w
    }
  }
  return groups
}

const STATUS_LABEL = {
  ok:           'No prazo',
  atrasado:     'Atrasado',
  concluido:    'Concluído',
  nao_iniciado: 'Não iniciado',
  em_andamento: 'Em andamento',
  suspenso:     'Suspenso',
}
const STATUS_COLOR = {
  ok:           '#22c55e',
  atrasado:     '#ef4444',
  concluido:    '#22c55e',
  nao_iniciado: '#9ca3af',
  em_andamento: '#eab308',
  suspenso:     '#f59e0b',
}

function Tooltip({ act, x, y, startDate }) {
  if (!act) return null
  const tipoCfg = TIPO_CFG[act.tipo] || TIPO_CFG.exec
  const status = act.status || 'nao_iniciado'
  const statusLabel = STATUS_LABEL[status] || status
  const statusColor = STATUS_COLOR[status] || C.gray500

  const left = Math.min(x + 14, window.innerWidth - 270)
  const top  = y + 14 + 210 > window.innerHeight ? y - 210 : y + 14

  const startDates = startDate && act.week_start ? getWeekDates(startDate, act.week_start)  : null
  const endDates   = startDate && act.week_end   ? getWeekDates(startDate, act.week_end)    : null

  return (
    <div style={{
      position: 'fixed', left, top, zIndex: 9999,
      background: '#1A1A2A',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 10, padding: '12px 14px',
      minWidth: 230, maxWidth: 290,
      boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
      pointerEvents: 'none', fontFamily: FONT_BODY,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#EBEBEB', marginBottom: 8, lineHeight: 1.3, wordBreak: 'break-word' }}>
        {act.name}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <div style={{ width: 10, height: 10, borderRadius: 3, background: tipoCfg.cor, flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: 'rgba(235,235,235,0.6)' }}>{tipoCfg.label}</span>
      </div>

      {/* Progress */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: 'rgba(235,235,235,0.6)' }}>Avanço</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#EBEBEB' }}>{act.pct || 0}%</span>
        </div>
        <div style={{ height: 5, background: 'rgba(255,255,255,0.1)', borderRadius: 5, overflow: 'hidden' }}>
          <div style={{ width: `${act.pct || 0}%`, height: '100%', background: status === 'atrasado' ? '#ef4444' : tipoCfg.cor, borderRadius: 5 }} />
        </div>
      </div>

      {/* Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor }} />
        <span style={{ fontSize: 11, color: statusColor, fontWeight: 600 }}>{statusLabel}</span>
      </div>

      {/* Semanas + datas */}
      <div style={{ fontSize: 11, color: 'rgba(235,235,235,0.5)', marginBottom: act.observacoes ? 8 : 0 }}>
        {startDates && endDates ? (
          <>Sem. {act.week_start}–{act.week_end} &nbsp;·&nbsp; {formatDateBR(startDates.start)} → {formatDateBR(endDates.end)}</>
        ) : (
          <>Sem. {act.week_start || '?'} → {act.week_end || '?'}</>
        )}
      </div>

      {/* Workers / Equipe */}
      {act.workers && act.workers.length > 0 && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(235,235,235,0.45)', letterSpacing: '0.07em', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
            <HardHatIcon size={11} color="rgba(235,235,235,0.45)" /> EQUIPE
          </div>
          {act.workers.map((w, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'rgba(235,235,235,0.75)', marginBottom: 3 }}>
              <span>{w.role}</span>
              <span style={{
                fontWeight: 700, color: '#EBEBEB',
                background: 'rgba(255,255,255,0.1)',
                padding: '1px 7px', borderRadius: 10, fontSize: 11,
              }}>{w.qty}x</span>
            </div>
          ))}
        </div>
      )}

      {/* Equipamentos */}
      {act.equipment && act.equipment.length > 0 && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(235,235,235,0.45)', letterSpacing: '0.07em', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
            <TractorIcon size={11} color="rgba(235,235,235,0.45)" /> EQUIPAMENTOS
          </div>
          {act.equipment.map((eq, i) => (
            <div key={i} style={{ fontSize: 11, color: 'rgba(235,235,235,0.75)', marginBottom: 3 }}>
              · {typeof eq === 'string' ? eq : (eq.qty > 1 ? `${eq.qty}x ${eq.name}` : eq.name)}
            </div>
          ))}
        </div>
      )}

      {/* Materiais vinculados */}
      {act.materials && act.materials.length > 0 && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(235,235,235,0.45)', letterSpacing: '0.07em', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width={11} height={11} viewBox="0 0 24 24" fill="rgba(235,235,235,0.45)"><path d="M20 6h-2.18c.07-.44.18-.88.18-1.36C18 2.08 15.89 0 13.5 0c-1.3 0-2.4.56-3.18 1.43L9 3.5 7.68 1.43C6.9.56 5.8 0 4.5 0 2.11 0 0 2.08 0 4.64c0 .48.11.92.18 1.36H-2v2h2v12a2 2 0 002 2h16a2 2 0 002-2V8h2V6zM9 4.64C9 3.19 10.12 2 11.5 2S14 3.19 14 4.64C14 5.5 13.59 6 13.5 6h-2.36C10.42 6 9 5.44 9 4.64z"/></svg>
            MATERIAIS
          </div>
          {act.materials.map((m, i) => {
            const sc = { pendente: '#94a3b8', pedido: '#f59e0b', parcial: '#f97316', chegou: '#22c55e', urgente: '#ef4444' }
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'rgba(235,235,235,0.75)', marginBottom: 3 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 155 }}>{m.name}</span>
                <span style={{ fontWeight: 700, color: sc[m.status] || '#EBEBEB', background: 'rgba(255,255,255,0.08)', padding: '1px 7px', borderRadius: 10, fontSize: 10, flexShrink: 0, marginLeft: 4 }}>
                  {m.quantity} {m.unit}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Observações */}
      {act.observacoes && (
        <div style={{
          marginTop: 8, padding: '7px 10px',
          background: 'rgba(239,68,68,0.15)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 6, fontSize: 11, color: '#fca5a5', lineHeight: 1.4, wordBreak: 'break-word',
        }}>
          <span style={{ fontWeight: 700, display: 'block', marginBottom: 2 }}>Observação:</span>
          {act.observacoes}
        </div>
      )}
    </div>
  )
}

/* ── Mobile bottom-sheet popup ── */
function MobilePopup({ act, startDate, onClose }) {
  if (!act) return null
  const tipoCfg = TIPO_CFG[act.tipo] || TIPO_CFG.exec
  const status = act.status || 'nao_iniciado'
  const statusLabel = STATUS_LABEL[status] || status
  const statusColor = STATUS_COLOR[status] || '#9ca3af'
  const barPct = act.pct || 0
  const isAtrasado = act.status === 'atrasado'
  const isConcluido = act.status === 'concluido' || barPct >= 100
  const barColor = isAtrasado ? '#ef4444' : isConcluido ? '#22c55e' : tipoCfg.cor

  const startDates = startDate && act.week_start ? getWeekDates(startDate, act.week_start) : null
  const endDates   = startDate && act.week_end   ? getWeekDates(startDate, act.week_end)   : null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 8000,
          background: 'rgba(0,0,0,0.5)',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        zIndex: 8001,
        background: '#1A1A2A',
        borderRadius: '16px 16px 0 0',
        padding: '20px 20px 36px',
        fontFamily: FONT_BODY,
        boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        {/* Handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: 'rgba(255,255,255,0.2)',
          margin: '0 auto 16px',
        }} />

        {/* Title */}
        <div style={{ fontSize: 15, fontWeight: 700, color: '#EBEBEB', marginBottom: 12, lineHeight: 1.3 }}>
          {act.name}
        </div>

        {/* Type badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: tipoCfg.cor, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'rgba(235,235,235,0.6)' }}>{tipoCfg.label}</span>
          <span style={{ margin: '0 4px', color: 'rgba(235,235,235,0.2)' }}>·</span>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor }} />
          <span style={{ fontSize: 12, color: statusColor, fontWeight: 600 }}>{statusLabel}</span>
        </div>

        {/* Progress */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: 'rgba(235,235,235,0.6)' }}>Avanço</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#EBEBEB' }}>{barPct}%</span>
          </div>
          <div style={{ height: 7, background: 'rgba(255,255,255,0.1)', borderRadius: 7, overflow: 'hidden' }}>
            <div style={{ width: `${barPct}%`, height: '100%', background: barColor, borderRadius: 7, transition: 'width 0.4s' }} />
          </div>
        </div>

        {/* Dates + completion timing */}
        {(startDates || act.week_start) && (
          <div style={{
            padding: '10px 12px',
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 8,
            fontSize: 13,
            color: 'rgba(235,235,235,0.7)',
            marginBottom: (act.completed_week || act.observacoes) ? 12 : 0,
          }}>
            <div>
              {startDates && endDates
                ? `Planejado: Sem. ${act.week_start}–${act.week_end}  ·  ${formatDateBR(startDates.start)} → ${formatDateBR(endDates.end)}`
                : `Planejado: Sem. ${act.week_start || '?'} → ${act.week_end || '?'}`
              }
            </div>
            {act.completed_week != null && (
              <div style={{ marginTop: 4 }}>
                {'Concluído: Sem. '}{act.completed_week}
                {(() => {
                  const diff = (act.week_end || 1) - act.completed_week
                  if (diff > 0) return <span style={{ color: '#22c55e', fontWeight: 700, marginLeft: 6 }}>▲ {diff} sem adiantado</span>
                  if (diff < 0) return <span style={{ color: '#ef4444', fontWeight: 700, marginLeft: 6 }}>▼ {Math.abs(diff)} sem atrasado</span>
                  return <span style={{ color: '#22c55e', fontWeight: 700, marginLeft: 6 }}>✓ No prazo</span>
                })()}
              </div>
            )}
          </div>
        )}

        {/* Workers / Equipe */}
        {act.workers && act.workers.length > 0 && (
          <div style={{
            marginTop: 12, padding: '10px 12px',
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 8,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(235,235,235,0.5)', letterSpacing: '0.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
              <HardHatIcon size={13} color="rgba(235,235,235,0.5)" /> EQUIPE
            </div>
            {act.workers.map((w, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: i < act.workers.length - 1 ? 6 : 0 }}>
                <span style={{ fontSize: 13, color: 'rgba(235,235,235,0.8)' }}>{w.role}</span>
                <span style={{
                  fontSize: 13, fontWeight: 700, color: '#EBEBEB',
                  background: 'rgba(255,255,255,0.12)',
                  padding: '2px 10px', borderRadius: 12,
                }}>{w.qty}x</span>
              </div>
            ))}
          </div>
        )}

        {/* Equipamentos */}
        {act.equipment && act.equipment.length > 0 && (
          <div style={{
            marginTop: 12, padding: '10px 12px',
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 8,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(235,235,235,0.5)', letterSpacing: '0.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
              <TractorIcon size={13} color="rgba(235,235,235,0.5)" /> EQUIPAMENTOS
            </div>
            {act.equipment.map((eq, i) => (
              <div key={i} style={{ fontSize: 13, color: 'rgba(235,235,235,0.8)', marginBottom: i < act.equipment.length - 1 ? 6 : 0 }}>
                · {typeof eq === 'string' ? eq : (eq.qty > 1 ? `${eq.qty}x ${eq.name}` : eq.name)}
              </div>
            ))}
          </div>
        )}

        {/* Materiais vinculados */}
        {act.materials && act.materials.length > 0 && (
          <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(255,255,255,0.06)', borderRadius: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(235,235,235,0.5)', letterSpacing: '0.06em', marginBottom: 8 }}>
              📦 MATERIAIS
            </div>
            {act.materials.map((m, i) => {
              const sc = { pendente: '#94a3b8', pedido: '#f59e0b', parcial: '#f97316', chegou: '#22c55e', urgente: '#ef4444' }
              return (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: i < act.materials.length - 1 ? 8 : 0 }}>
                  <span style={{ fontSize: 13, color: 'rgba(235,235,235,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{m.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: sc[m.status] || '#EBEBEB', background: 'rgba(255,255,255,0.12)', padding: '2px 10px', borderRadius: 12, flexShrink: 0, marginLeft: 8 }}>
                    {m.quantity} {m.unit}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Observações */}
        {act.observacoes && (
          <div style={{
            marginTop: 12, padding: '10px 12px',
            background: 'rgba(239,68,68,0.15)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8, fontSize: 12, color: '#fca5a5', lineHeight: 1.5,
          }}>
            <span style={{ fontWeight: 700, display: 'block', marginBottom: 3 }}>Observação:</span>
            {act.observacoes}
          </div>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            marginTop: 18, width: '100%', padding: '12px',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10, color: '#EBEBEB', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: FONT_BODY,
          }}
        >
          Fechar
        </button>
      </div>
    </>
  )
}

export default function Gantt({ activities = [], weeks = 20, currentWeek = 1, startDate = null, materials = [] }) {
  const [hoveredAct, setHoveredAct] = useState(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [selectedAct, setSelectedAct] = useState(null)  // mobile tap selection
  const isMobile = useIsMobile()

  // Enrich each activity with its linked materials
  const enrichedActivities = activities.map(act => ({
    ...act,
    materials: materials.filter(m => m.activity_id === act.id),
  }))

  const groups  = groupBy(enrichedActivities, 'group_name')
  const weekArr = Array.from({ length: weeks }, (_, i) => i + 1)
  const monthGroups = getMonthGroups(startDate, weeks)

  // Compact on mobile: narrower columns, shorter rows, smaller left panel
  const COL_W  = isMobile ? 26  : 34
  const ROW_H  = isMobile ? 36  : 64
  const LEFT_W = isMobile ? 160 : 300

  const handleMouseMove = useCallback(e => {
    setMousePos({ x: e.clientX, y: e.clientY })
  }, [])

  return (
    <div style={{ fontFamily: FONT_BODY, fontSize: 12, overflowX: 'auto', position: 'relative' }} onMouseMove={handleMouseMove}>
      <style>{`
        @keyframes gantt-ping {
          0%   { transform: scale(1);   opacity: 0.9; }
          70%  { transform: scale(2.6); opacity: 0;   }
          100% { transform: scale(2.6); opacity: 0;   }
        }
        .gantt-em-andamento-dot {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .gantt-em-andamento-dot::before {
          content: '';
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: #eab308;
          animation: gantt-ping 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
      `}</style>
      {/* Desktop hover tooltip */}
      {!isMobile && <Tooltip act={hoveredAct} x={mousePos.x} y={mousePos.y} startDate={startDate} />}
      {/* Mobile tap bottom-sheet */}
      {isMobile && <MobilePopup act={selectedAct} startDate={startDate} onClose={() => setSelectedAct(null)} />}

      <div style={{ minWidth: LEFT_W + weeks * COL_W }}>

        {/* Month header */}
        <div style={{ display: 'flex', borderBottom: `1px solid rgba(255,255,255,0.08)` }}>
          <div style={{
            width: LEFT_W, minWidth: LEFT_W, flexShrink: 0,
            padding: '6px 12px', background: C.surface, color: '#EBEBEB',
            fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 10 : 12, letterSpacing: '0.05em',
            position: 'sticky', left: 0, zIndex: 3,
          }}>
            ATIVIDADE
          </div>
          {monthGroups.map((m, i) => (
            <div key={i} style={{
              width: (m.endW - m.startW + 1) * COL_W, minWidth: (m.endW - m.startW + 1) * COL_W,
              flexShrink: 0, padding: '6px 0', textAlign: 'center',
              background: C.surface, color: 'rgba(235,235,235,0.55)',
              fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 11, letterSpacing: '0.06em',
              borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none',
            }}>
              {m.label}
            </div>
          ))}
        </div>

        {/* Week header */}
        <div style={{ display: 'flex', background: C.gray50, borderBottom: `2px solid ${C.gray200}` }}>
          <div style={{
            width: LEFT_W, minWidth: LEFT_W, flexShrink: 0,
            padding: '4px 12px', fontSize: 10, color: C.black, fontWeight: 700, letterSpacing: '0.05em',
            position: 'sticky', left: 0, zIndex: 3, background: C.gray50,
          }}>
            {isMobile ? 'ATIVIDADE' : 'ETAPA / ATIVIDADE'}
          </div>
          {weekArr.map(w => {
            const dates = startDate ? getWeekDates(startDate, w) : null
            const isCurrentWeek = w === currentWeek
            return (
              <div key={w} style={{
                width: COL_W, minWidth: COL_W, flexShrink: 0,
                textAlign: 'center', padding: '3px 0',
                borderLeft: `1px solid ${C.gray200}`,
                background: isCurrentWeek ? C.orangeLight : 'transparent',
              }}>
                <div style={{ fontSize: isMobile ? 8 : 10, fontWeight: isCurrentWeek ? 800 : 600, color: isCurrentWeek ? C.orange : C.black }}>
                  {w}
                </div>
                {/* Show date only on desktop */}
                {!isMobile && dates && (
                  <div style={{ fontSize: 8, color: isCurrentWeek ? C.orange : C.black, lineHeight: 1.2, opacity: isCurrentWeek ? 1 : 0.6 }}>
                    {formatDateBR(dates.start)}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Groups + rows */}
        {Object.entries(groups).map(([groupName, acts]) => (
          <div key={groupName}>
            {/* Group header */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${C.gray700}` }}>
              <div style={{
                width: LEFT_W, minWidth: LEFT_W, flexShrink: 0,
                padding: isMobile ? '5px 8px' : '7px 12px',
                background: C.surface, color: '#EBEBEB',
                fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 9 : 11,
                letterSpacing: '0.07em', textTransform: 'uppercase',
                position: 'sticky', left: 0, zIndex: 2,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {groupName}
              </div>
              {weekArr.map(w => (
                <div key={w} style={{
                  width: COL_W, minWidth: COL_W, flexShrink: 0,
                  background: w === currentWeek ? C.orangeLight : C.surface,
                  borderLeft: '1px solid rgba(255,255,255,0.06)',
                }} />
              ))}
            </div>

            {/* Activity rows */}
            {acts.map((act, ri) => {
              const isConcluido  = act.status === 'concluido' || (act.pct || 0) >= 100
              const isAtrasado   = act.status === 'atrasado'
              const tipoCfg      = TIPO_CFG[act.tipo] || TIPO_CFG.exec
              const barPct       = act.pct || 0
              const isHovered    = hoveredAct === act

              // ── Completion timing ──────────────────────────────────────
              const planStart = act.week_start || 1
              const planEnd   = act.week_end   || 1
              const compWeek  = act.completed_week  // null if not completed yet
              const hasComp   = isConcluido && compWeek != null

              // Actual bar range: if completed, use completed_week; else planned end
              const actualEnd  = hasComp ? compWeek : planEnd
              const weeksEarly = hasComp ? planEnd - compWeek : 0  // positive = ahead
              const weeksDiff  = hasComp ? compWeek - planEnd  : 0  // positive = late

              // Bar color
              const barColor = isAtrasado && !isConcluido
                ? C.red
                : isConcluido
                  ? (weeksEarly > 0 ? '#22c55e' : weeksEarly < 0 ? '#ef4444' : '#22c55e')
                  : tipoCfg.cor

              const barH     = isMobile ? 14 : 22
              const planBarH = isMobile ? 8  : 12   // thinner planned-reference bar

              return (
                <div
                  key={act.id || ri}
                  style={{
                    display: 'flex',
                    height: ROW_H,
                    borderBottom: `1px solid ${C.gray200}`,
                    background: isHovered ? 'rgba(59,130,246,0.06)' : ri % 2 === 0 ? C.white : C.gray50,
                    cursor: isMobile ? 'pointer' : 'default',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={() => !isMobile && setHoveredAct(act)}
                  onMouseLeave={() => !isMobile && setHoveredAct(null)}
                  onClick={() => isMobile && setSelectedAct(act)}
                >
                  {/* Left label */}
                  <div style={{
                    width: LEFT_W, minWidth: LEFT_W, flexShrink: 0,
                    padding: isMobile ? '0 8px' : '4px 12px',
                    display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: isMobile ? 0 : 3,
                    position: 'sticky', left: 0, zIndex: 1,
                    background: isHovered ? 'rgba(59,130,246,0.06)' : ri % 2 === 0 ? C.white : C.gray50,
                    borderRight: `1px solid ${C.gray200}`,
                    transition: 'background 0.1s',
                  }}>
                    {/* Name + status icon */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                      {isConcluido && (
                        <span style={{ color: '#22c55e', fontSize: isMobile ? 10 : 12, flexShrink: 0, lineHeight: 1 }}>✓</span>
                      )}
                      {isAtrasado && !isConcluido && (
                        <span style={{ color: '#ef4444', fontSize: isMobile ? 10 : 14, flexShrink: 0, lineHeight: 1, fontWeight: 700 }}>—</span>
                      )}
                      {act.status === 'em_andamento' && !isConcluido && !isAtrasado && (
                        <span className="gantt-em-andamento-dot" style={{ width: isMobile ? 6 : 8, height: isMobile ? 6 : 8, flexShrink: 0 }}>
                          <span style={{ width: isMobile ? 6 : 8, height: isMobile ? 6 : 8, borderRadius: '50%', background: '#eab308', display: 'block', position: 'relative', zIndex: 1 }} />
                        </span>
                      )}
                      <div style={{
                        fontSize: isMobile ? 10 : 12, color: C.black, fontWeight: 500,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1,
                      }} title={act.name}>
                        {act.name}
                      </div>
                    </div>

                    {/* Desktop: progress + date + completion badge */}
                    {!isMobile && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ flex: 1, height: 3, background: C.gray200, borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${barPct}%`, height: '100%', background: barColor, borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 10, color: C.gray500, flexShrink: 0 }}>{barPct}%</span>
                        </div>
                        {/* Date range */}
                        {startDate && planStart && planEnd && (() => {
                          const sd = getWeekDates(startDate, planStart)
                          const ed = getWeekDates(startDate, planEnd)
                          return sd && ed ? (
                            <div style={{ fontSize: 9, color: C.black, opacity: 0.5 }}>
                              {formatDateBR(sd.start)} → {formatDateBR(ed.end)}
                            </div>
                          ) : null
                        })()}
                        {/* Completion timing badge */}
                        {hasComp && weeksEarly !== 0 && (
                          <div style={{
                            fontSize: 9, fontWeight: 700, flexShrink: 0,
                            color: weeksEarly > 0 ? '#22c55e' : '#ef4444',
                          }}>
                            {weeksEarly > 0 ? `▲ ${weeksEarly} sem adiantado` : `▼ ${Math.abs(weeksEarly)} sem atrasado`}
                          </div>
                        )}
                      </>
                    )}

                    {/* Mobile: % + timing badge */}
                    {isMobile && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{
                          fontSize: 9, fontWeight: 700, lineHeight: 1,
                          color: isAtrasado ? C.red : isConcluido ? '#22c55e' : C.gray500,
                        }}>
                          {barPct}%
                        </span>
                        {hasComp && weeksEarly !== 0 && (
                          <span style={{ fontSize: 8, fontWeight: 700, color: weeksEarly > 0 ? '#22c55e' : '#ef4444' }}>
                            {weeksEarly > 0 ? `▲${weeksEarly}S` : `▼${Math.abs(weeksEarly)}S`}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Week cells */}
                  {weekArr.map(w => {
                    // ── Ranges ──────────────────────────────────────────────
                    // Planned reference: always show the full planned window
                    const inPlanned  = w >= planStart && w <= planEnd
                    // Actual execution: only visible when work has started or activity is done
                    const inActual   = w >= planStart && w <= actualEnd && (barPct > 0 || isConcluido)
                    // Overrun: completed late — extends past planEnd
                    const inOverrun  = hasComp && weeksDiff > 0 && w > planEnd && w <= compWeek

                    // ── Cap helpers ─────────────────────────────────────────
                    const isFirstPlan    = w === planStart
                    const isLastPlan     = w === planEnd
                    const isLastActual   = w === actualEnd
                    const isLastOverrun  = hasComp && w === compWeek

                    return (
                      <div key={w} style={{
                        width: COL_W, minWidth: COL_W, flexShrink: 0,
                        borderLeft: `1px solid ${C.gray200}`,
                        position: 'relative',
                        overflow: 'hidden',   // prevents transform bleed
                      }}>
                        {/* Current-week tint */}
                        {w === currentWeek && (
                          <div style={{
                            position: 'absolute', inset: 0,
                            background: C.orangeLight, opacity: 0.45, zIndex: 0,
                          }} />
                        )}

                        {/* ── Layer 1: Planned reference bar (always visible) ── */}
                        {inPlanned && (
                          <div style={{
                            position: 'absolute',
                            left:  isFirstPlan ? 2 : 0,
                            right: isLastPlan  ? 2 : 0,
                            top: '50%', transform: 'translateY(-50%)',
                            height: planBarH,
                            border: `1.5px dashed ${tipoCfg.cor}`,
                            background: 'transparent',
                            borderRadius: isFirstPlan && isLastPlan
                              ? planBarH
                              : isFirstPlan ? `${planBarH}px 0 0 ${planBarH}px`
                              : isLastPlan  ? `0 ${planBarH}px ${planBarH}px 0`
                              : 0,
                            opacity: 0.75,
                            zIndex: 1,
                          }} />
                        )}

                        {/* ── Layer 2: Actual bar (solid, shown when work ≥ 0 started or concluido) ── */}
                        {inActual && (
                          <div style={{
                            position: 'absolute',
                            left:  isFirstPlan   ? 2 : 0,
                            right: isLastActual  ? 2 : 0,
                            top: '50%', transform: 'translateY(-50%)',
                            height: barH,
                            background: barColor,
                            borderRadius: isFirstPlan && isLastActual
                              ? barH
                              : isFirstPlan  ? `${barH}px 0 0 ${barH}px`
                              : isLastActual ? `0 ${barH}px ${barH}px 0`
                              : 0,
                            opacity: 0.92,
                            zIndex: 2,
                          }} />
                        )}

                        {/* ── Layer 3: Overrun bar (completed late — past planEnd) ── */}
                        {inOverrun && (
                          <div style={{
                            position: 'absolute',
                            left: 0,
                            right: isLastOverrun ? 2 : 0,
                            top: '50%', transform: 'translateY(-50%)',
                            height: barH,
                            background: '#ef4444',
                            borderRadius: isLastOverrun ? `0 ${barH}px ${barH}px 0` : 0,
                            opacity: 0.85,
                            zIndex: 3,
                          }} />
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        ))}

        {activities.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, color: C.gray300, fontSize: 14 }}>
            Nenhuma atividade cadastrada
          </div>
        )}

        {/* Legend — hide on mobile */}
        {!isMobile && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '12px 16px', borderTop: `1px solid ${C.gray200}`, background: C.gray50 }}>
            {Object.entries(TIPO_CFG).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 14, height: 8, background: v.cor, borderRadius: 3 }} />
                <span style={{ fontSize: 11, color: C.gray500 }}>{v.label}</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#22c55e', fontSize: 13, lineHeight: 1 }}>✓</span>
              <span style={{ fontSize: 11, color: C.gray500 }}>Concluído</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#ef4444', fontSize: 16, fontWeight: 700, lineHeight: 1 }}>—</span>
              <span style={{ fontSize: 11, color: C.gray500 }}>Atrasado</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#eab308' }} />
              <span style={{ fontSize: 11, color: C.gray500 }}>Em andamento</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="8"><rect x="0" y="2" width="14" height="4" rx="2" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="3 2" /></svg>
              <span style={{ fontSize: 11, color: C.gray500 }}>Planejado</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 14, height: 8, background: C.orangeLight, borderRadius: 3, border: `1px solid ${C.orange}` }} />
              <span style={{ fontSize: 11, color: C.gray500 }}>Semana atual</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
