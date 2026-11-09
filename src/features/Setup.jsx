import { useState } from 'react'
import { C, FONT_BODY, FONT_DISPLAY, TIPO_CFG, GRUPOS_PADRAO } from '../tokens'
import { Btn, Input, Select, Textarea, Alert, Spinner, Icon, Badge } from '../components/ui'
import { gerarCronograma } from '../lib/ai'

function generateId() {
  return `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function ActivityRowPreview({ act, onRemove }) {
  const tc = TIPO_CFG[act.tipo] || TIPO_CFG.exec
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 12px',
      borderBottom: `1px solid ${C.gray100}`,
      background: C.white,
    }}>
      <div style={{
        width: 10, height: 10,
        borderRadius: 2,
        background: tc.cor,
        flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.black }}>
          {act.name}
        </div>
        <div style={{ fontSize: 11, color: C.gray500 }}>
          {act.group_name || act.grupo || '—'} · S{act.week_start ?? act.sIni ?? 1}–S{act.week_end ?? act.sFim ?? 1}
        </div>
      </div>
      <Badge label={tc.label} cor={tc.cor} bg={C.gray100} />
      <button
        onClick={onRemove}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: C.red, padding: 4, borderRadius: 4, display: 'flex',
        }}
      >
        <Icon name="x" size={14} color={C.red} />
      </button>
    </div>
  )
}

export default function Setup({ weeks = 20, onSave, onCancel }) {
  const [activities, setActivities] = useState([])
  const [aiInput, setAiInput] = useState('')
  const [generating, setGenerating] = useState(false)
  const [aiError, setAiError] = useState('')
  const [saving, setSaving] = useState(false)

  // Manual add form
  const [manualForm, setManualForm] = useState({
    name: '',
    grupo: '',
    week_start: 1,
    week_end: 1,
    tipo: 'exec',
  })

  const weekOptions = Array.from({ length: weeks }, (_, i) => i + 1)

  async function handleGenerate() {
    if (!aiInput.trim()) {
      setAiError('Descreva a obra para a IA gerar o cronograma.')
      return
    }
    setGenerating(true)
    setAiError('')
    try {
      const generated = await gerarCronograma(aiInput.trim())
      if (!generated || generated.length === 0) {
        setAiError('A IA não conseguiu gerar atividades. Tente ser mais específico na descrição.')
        return
      }
      // Normalize the response
      const normalized = generated.map(a => ({
        id: generateId(),
        name: a.nome || a.name || 'Atividade sem nome',
        group_name: a.grupo || a.group_name || 'Geral',
        week_start: Math.max(1, Math.min(weeks, a.sIni || a.week_start || 1)),
        week_end: Math.max(1, Math.min(weeks, a.sFim || a.week_end || 1)),
        tipo: a.tipo || 'exec',
        pct: a.pct || 0,
        status: 'nao_iniciado',
      }))
      setActivities(prev => [...prev, ...normalized])
    } catch (err) {
      setAiError(err.message || 'Erro ao consultar IA.')
    } finally {
      setGenerating(false)
    }
  }

  function handleAddManual() {
    if (!manualForm.name.trim()) return
    const act = {
      id: generateId(),
      name: manualForm.name.trim(),
      group_name: manualForm.grupo.trim() || 'Geral',
      week_start: Number(manualForm.week_start),
      week_end: Number(manualForm.week_end),
      tipo: manualForm.tipo,
      pct: 0,
      status: 'nao_iniciado',
    }
    setActivities(prev => [...prev, act])
    setManualForm(f => ({ ...f, name: '', grupo: '' }))
  }

  function handleRemove(id) {
    setActivities(prev => prev.filter(a => a.id !== id))
  }

  function handleAddDefaultGroups() {
    const acts = GRUPOS_PADRAO.map(g => ({
      id: generateId(),
      name: `Serviços de ${g.toLowerCase()}`,
      group_name: g,
      week_start: 1,
      week_end: Math.max(1, Math.round(weeks / GRUPOS_PADRAO.length)),
      tipo: 'exec',
      pct: 0,
      status: 'nao_iniciado',
    }))
    setActivities(prev => [...prev, ...acts])
  }

  async function handleSave() {
    if (activities.length === 0) return
    setSaving(true)
    try {
      await onSave(activities)
    } finally {
      setSaving(false)
    }
  }

  // Group for display
  const byGroup = activities.reduce((acc, a) => {
    const g = a.group_name || 'Geral'
    if (!acc[g]) acc[g] = []
    acc[g].push(a)
    return acc
  }, {})

  return (
    <div style={{ fontFamily: FONT_BODY }}>
      {/* AI section */}
      <div style={{
        background: C.black,
        borderRadius: 10,
        padding: '20px',
        marginBottom: 24,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 12,
        }}>
          <div style={{
            width: 32, height: 32,
            background: C.orange,
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: C.white, fontSize: 12, fontWeight: 800, fontFamily: FONT_DISPLAY }}>IA</span>
          </div>
          <div style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: 16,
            color: C.white,
            letterSpacing: '0.04em',
          }}>
            GERAR CRONOGRAMA COM IA
          </div>
        </div>

        <div style={{ fontSize: 12, color: C.gray400, marginBottom: 14, lineHeight: 1.5 }}>
          Descreva a obra (tipo, etapas, especificidades) e a IA irá gerar automaticamente as atividades do cronograma.
        </div>

        {aiError && (
          <div style={{ marginBottom: 12 }}>
            <Alert type="warning">{aiError}</Alert>
          </div>
        )}

        <Textarea
          value={aiInput}
          onChange={e => setAiInput(e.target.value)}
          placeholder="Ex: Construção de muro de arrimo em concreto armado, 50m de extensão, 3m de altura. Inclui escavação, formas, ferragem, concretagem e impermeabilização."
          rows={4}
          style={{ background: C.gray900 || '#1a1a1a', color: C.white, border: `1px solid ${C.gray700}` }}
          disabled={generating}
        />

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <Btn
            variant="primary"
            icon={generating ? 'refresh' : 'chat'}
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? 'Gerando...' : 'Gerar com IA'}
          </Btn>
          {generating && <Spinner />}
        </div>
      </div>

      {/* Manual add */}
      <div style={{
        background: C.white,
        border: `1px solid ${C.gray200}`,
        borderRadius: 10,
        padding: '16px',
        marginBottom: 20,
      }}>
        <div style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 700,
          fontSize: 14,
          color: C.black,
          letterSpacing: '0.05em',
          marginBottom: 12,
        }}>
          ADICIONAR MANUALMENTE
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 120px 70px 70px 120px 80px',
          gap: 8,
          alignItems: 'flex-end',
        }}>
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: C.gray500, marginBottom: 4, textTransform: 'uppercase' }}>
              Nome da atividade
            </label>
            <Input
              value={manualForm.name}
              onChange={e => setManualForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleAddManual()}
              placeholder="Ex: Escavação manual"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: C.gray500, marginBottom: 4, textTransform: 'uppercase' }}>
              Grupo
            </label>
            <Input
              value={manualForm.grupo}
              onChange={e => setManualForm(f => ({ ...f, grupo: e.target.value }))}
              placeholder="Grupo / etapa"
              list="setup-groups"
            />
            <datalist id="setup-groups">
              {GRUPOS_PADRAO.map(g => <option key={g} value={g} />)}
            </datalist>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: C.gray500, marginBottom: 4, textTransform: 'uppercase' }}>
              Início
            </label>
            <Select
              value={manualForm.week_start}
              onChange={e => setManualForm(f => ({ ...f, week_start: Number(e.target.value) }))}
            >
              {weekOptions.map(w => <option key={w} value={w}>S{w}</option>)}
            </Select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: C.gray500, marginBottom: 4, textTransform: 'uppercase' }}>
              Fim
            </label>
            <Select
              value={manualForm.week_end}
              onChange={e => setManualForm(f => ({ ...f, week_end: Number(e.target.value) }))}
            >
              {weekOptions.filter(w => w >= manualForm.week_start).map(w => <option key={w} value={w}>S{w}</option>)}
            </Select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: C.gray500, marginBottom: 4, textTransform: 'uppercase' }}>
              Tipo
            </label>
            <Select
              value={manualForm.tipo}
              onChange={e => setManualForm(f => ({ ...f, tipo: e.target.value }))}
            >
              {Object.entries(TIPO_CFG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </Select>
          </div>

          <Btn variant="black" icon="plus" onClick={handleAddManual} style={{ alignSelf: 'flex-end' }}>
            Add
          </Btn>
        </div>
      </div>

      {/* Activity list */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}>
          <div style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: 16,
            color: C.black,
            letterSpacing: '0.03em',
          }}>
            ATIVIDADES ({activities.length})
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {activities.length === 0 && (
              <Btn variant="secondary" size="sm" icon="refresh" onClick={handleAddDefaultGroups}>
                Grupos padrão
              </Btn>
            )}
            {activities.length > 0 && (
              <Btn variant="ghost" size="sm" icon="trash" onClick={() => setActivities([])}>
                Limpar tudo
              </Btn>
            )}
          </div>
        </div>

        {activities.length === 0 ? (
          <div style={{
            border: `2px dashed ${C.gray200}`,
            borderRadius: 10,
            padding: '32px 24px',
            textAlign: 'center',
            color: C.gray400,
          }}>
            <Icon name="calendar" size={36} color={C.gray300} style={{ margin: '0 auto 10px' }} />
            <div style={{ fontSize: 13 }}>
              Nenhuma atividade ainda. Use a IA ou adicione manualmente.
            </div>
          </div>
        ) : (
          <div style={{ border: `1px solid ${C.gray200}`, borderRadius: 10, overflow: 'hidden' }}>
            {Object.entries(byGroup).map(([groupName, acts]) => (
              <div key={groupName}>
                <div style={{
                  padding: '6px 12px',
                  background: C.gray900,
                  color: C.white,
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 700,
                  fontSize: 11,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                }}>
                  {groupName}
                  <span style={{ color: C.gray400, fontWeight: 400, marginLeft: 8 }}>
                    {acts.length} atividade(s)
                  </span>
                </div>
                {acts.map(a => (
                  <ActivityRowPreview
                    key={a.id}
                    act={a}
                    onRemove={() => handleRemove(a.id)}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{
        display: 'flex',
        gap: 10,
        justifyContent: 'flex-end',
        paddingTop: 16,
        borderTop: `1px solid ${C.gray200}`,
      }}>
        {onCancel && (
          <Btn variant="secondary" onClick={onCancel} disabled={saving}>
            Cancelar
          </Btn>
        )}
        <Btn
          variant="primary"
          icon="check"
          onClick={handleSave}
          disabled={activities.length === 0 || saving}
        >
          {saving ? 'Salvando...' : `Iniciar programação (${activities.length} atividades)`}
        </Btn>
      </div>
    </div>
  )
}
