import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { C, FONT_BODY, FONT_DISPLAY } from '../tokens'

/**
 * Computes cumulative % curve for a list of activities up to maxWeek.
 * Each activity has EQUAL weight (1/n) — same logic as overall_pct in the DB.
 * This ensures the "executado" curve at currentWeek matches the header %.
 * For "planejado" (baseline), pct accumulates linearly within the activity's range.
 */
function computeCurve(activities, weeks, mode = 'executado', currentWeek = null) {
  if (!activities || activities.length === 0) return []

  const maxW = currentWeek !== null ? Math.min(currentWeek, weeks) : weeks
  const n = activities.length  // equal weight per activity = 1/n

  return Array.from({ length: weeks }, (_, i) => {
    const w = i + 1

    if (mode === 'executado' && w > maxW) return { week: w, pct: null }

    let cumSum = 0

    activities.forEach(act => {
      const s = act.week_start || 1
      const plannedEnd = act.week_end || weeks
      const plannedDuration = Math.max(1, plannedEnd - s + 1)
      const weight = 1 / n  // equal weight — each activity counts the same

      if (mode === 'planejado') {
        if (w >= plannedEnd) {
          cumSum += weight * 100
        } else if (w >= s) {
          cumSum += weight * ((w - s + 1) / plannedDuration) * 100
        }
      } else {
        const isConcluido = act.status === 'concluido' || (act.pct || 0) >= 100
        const effectiveEnd = (isConcluido && act.completed_week != null)
          ? act.completed_week
          : plannedEnd
        const effectiveDuration = Math.max(1, effectiveEnd - s + 1)
        const actPct = act.pct || 0

        if (w >= effectiveEnd) {
          cumSum += weight * actPct
        } else if (w >= s) {
          const weeksIn = w - s + 1
          cumSum += weight * Math.min(actPct, (weeksIn / effectiveDuration) * actPct)
        }
      }
    })

    // cumSum in 0–100 range since weights sum to 1
    return {
      week: w,
      pct: Math.round(cumSum * 10) / 10,
    }
  })
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null
  return (
    <div style={{
      background: C.white,
      border: `1px solid ${C.gray200}`,
      borderRadius: 8,
      padding: '10px 14px',
      fontFamily: FONT_BODY,
      fontSize: 13,
      boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: C.black }}>
        Semana {label}
      </div>
      {payload.map((p, i) => (
        p.value !== null && (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: p.color }} />
            <span style={{ color: C.gray700 }}>{p.name}:</span>
            <span style={{ fontWeight: 700, color: C.black }}>{p.value}%</span>
          </div>
        )
      ))}
    </div>
  )
}

export default function SCurve({ activities = [], baseline, currentWeek = 1, weeks = 20 }) {
  const hasBaseline = baseline && baseline.activities && baseline.activities.length > 0

  const executedCurve = computeCurve(activities, weeks, 'executado', currentWeek)
  const plannedCurve = hasBaseline
    ? computeCurve(baseline.activities, weeks, 'planejado', null)
    : computeCurve(activities, weeks, 'planejado', null)

  // Merge into single data array
  const data = Array.from({ length: weeks }, (_, i) => {
    const w = i + 1
    return {
      week: w,
      planejado: plannedCurve[i]?.pct ?? null,
      executado: executedCurve[i]?.pct ?? null,
    }
  })

  // Deviation at current week: executed vs planned
  const execAtCurrent = executedCurve[currentWeek - 1]?.pct ?? null
  const planAtCurrent = plannedCurve[currentWeek - 1]?.pct ?? null
  const deviation = (execAtCurrent != null && planAtCurrent != null)
    ? Math.round((execAtCurrent - planAtCurrent) * 10) / 10
    : null

  return (
    <div style={{ fontFamily: FONT_BODY }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
      }}>
        <div style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 700,
          fontSize: 16,
          color: C.black,
          letterSpacing: '0.03em',
        }}>
          CURVA S — AVANÇO FÍSICO
        </div>
        {!hasBaseline && (
          <div style={{
            fontSize: 11,
            color: C.amber,
            background: C.amberLight,
            padding: '3px 10px',
            borderRadius: 20,
            fontWeight: 600,
          }}>
            Sem baseline — usando planejamento atual
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={data} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.gray200} />
          <XAxis
            dataKey="week"
            tick={{ fontFamily: FONT_BODY, fontSize: 11, fill: C.gray500 }}
            label={{ value: 'Semana', position: 'insideBottom', offset: -2, fontSize: 11, fill: C.gray500 }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={v => `${v}%`}
            tick={{ fontFamily: FONT_BODY, fontSize: 11, fill: C.gray500 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontFamily: FONT_BODY, fontSize: 12, paddingTop: 8 }}
            formatter={(value) => (
              <span style={{ color: C.gray700 }}>
                {value === 'planejado' ? 'Planejado' : 'Executado'}
              </span>
            )}
          />
          <ReferenceLine
            x={currentWeek}
            stroke={C.orange}
            strokeDasharray="4 3"
            label={{
              value: `S${currentWeek}`,
              position: 'top',
              fontSize: 10,
              fill: C.orange,
              fontFamily: FONT_BODY,
            }}
          />
          <Line
            type="monotone"
            dataKey="planejado"
            name="planejado"
            stroke={C.orange}
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={false}
            connectNulls={false}
            activeDot={{ r: 5, fill: C.orange, stroke: C.white, strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="executado"
            name="executado"
            stroke="#22c55e"
            strokeWidth={2.5}
            dot={false}
            connectNulls={false}
            activeDot={{ r: 5, fill: '#22c55e', stroke: C.white, strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>

      <div style={{
        display: 'flex',
        gap: 20,
        marginTop: 12,
        padding: '10px 16px',
        background: C.gray50,
        borderRadius: 8,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="28" height="8">
            <line x1="0" y1="4" x2="28" y2="4" stroke={C.orange} strokeWidth="2" strokeDasharray="6 3" />
          </svg>
          <span style={{ fontSize: 12, color: C.gray700 }}>
            Planejado {hasBaseline ? `(Baseline: ${baseline.name || 'Inicial'})` : '(Cronograma atual)'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="28" height="8">
            <line x1="0" y1="4" x2="28" y2="4" stroke="#22c55e" strokeWidth="2.5" />
          </svg>
          <span style={{ fontSize: 12, color: C.gray700 }}>Executado (real)</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: C.gray500 }}>
            Semana atual: <strong style={{ color: C.orange }}>{currentWeek}</strong>
          </span>
          {deviation != null && (
            <span style={{
              fontSize: 12, fontWeight: 700,
              color: deviation > 0 ? '#22c55e' : deviation < 0 ? '#ef4444' : C.gray500,
              background: deviation > 0 ? 'rgba(34,197,94,0.1)' : deviation < 0 ? 'rgba(239,68,68,0.1)' : C.gray100,
              padding: '2px 10px', borderRadius: 20,
            }}>
              {deviation > 0
                ? `▲ +${deviation}% adiantado`
                : deviation < 0
                  ? `▼ ${deviation}% atrasado`
                  : '✓ No prazo'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
