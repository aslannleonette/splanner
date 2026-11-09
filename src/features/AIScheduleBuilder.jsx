import { useState, useRef } from 'react'
import { C, FONT_BODY, FONT_DISPLAY, TIPO_CFG } from '../tokens'
import { Btn, Icon, Spinner } from '../components/ui'
import { gerarCronograma } from '../lib/ai'

function generateId() {
  return `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function PreviewActivity({ act }) {
  const tipo = TIPO_CFG[act.tipo] || TIPO_CFG.exec
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 100px 60px 60px',
      gap: 8,
      padding: '6px 12px',
      borderBottom: `1px solid ${C.gray100}`,
      fontSize: 13,
      alignItems: 'center',
      fontFamily: FONT_BODY,
    }}>
      <span style={{ color: C.black }}>{act.nome || act.name}</span>
      <span style={{
        fontSize: 11,
        background: C.gray100,
        color: C.gray700,
        padding: '2px 7px',
        borderRadius: 10,
        fontWeight: 600,
        textAlign: 'center',
      }}>{tipo.label}</span>
      <span style={{ color: C.gray500, fontSize: 12, textAlign: 'center' }}>S{act.sIni}</span>
      <span style={{ color: C.gray500, fontSize: 12, textAlign: 'center' }}>S{act.sFim}</span>
    </div>
  )
}

export default function AIScheduleBuilder({ weeks = 20, onAccept, onClose }) {
  const [mode, setMode] = useState('texto')
  const [prompt, setPrompt] = useState('')
  const [docText, setDocText] = useState('')
  const [docName, setDocName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)
  const fileRef = useRef()

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setDocName(file.name)
    setError('')
    const reader = new FileReader()
    reader.onload = ev => setDocText(ev.target.result)
    reader.onerror = () => setError('Erro ao ler o arquivo.')
    reader.readAsText(file, 'UTF-8')
  }

  async function handleGenerate() {
    const descricao = mode === 'texto' ? prompt.trim() : docText.trim()
    if (!descricao) {
      setError(mode === 'texto' ? 'Descreva os serviços da obra.' : 'Carregue ou cole o conteúdo do documento.')
      return
    }
    setLoading(true)
    setError('')
    setPreview(null)
    try {
      const result = await gerarCronograma({ descricao, semanas: weeks })
      if (!result || result.length === 0) {
        setError('A IA não retornou atividades. Tente uma descrição mais detalhada.')
      } else {
        setPreview(result)
      }
    } catch (err) {
      setError(err.message || 'Erro ao gerar cronograma.')
    } finally {
      setLoading(false)
    }
  }

  function handleAccept() {
    if (!preview) return
    const activities = preview.map(act => ({
      id: generateId(),
      name: act.nome || act.name || '',
      group_name: act.grupo || act.group || 'GERAL',
      tipo: act.tipo || 'exec',
      week_start: Math.max(1, Math.min(weeks, Number(act.sIni) || 1)),
      week_end: Math.max(1, Math.min(weeks, Number(act.sFim) || 1)),
      pct: 0,
      status: 'nao_iniciado',
    }))
    onAccept(activities)
  }

  const grouped = preview
    ? preview.reduce((acc, a) => {
        const g = a.grupo || a.group || 'GERAL'
        if (!acc[g]) acc[g] = []
        acc[g].push(a)
        return acc
      }, {})
    : null

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.65)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 16,
    }}>
      <div style={{
        background: C.white,
        borderRadius: 14,
        width: '100%',
        maxWidth: 700,
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: FONT_BODY,
        boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 24px',
          borderBottom: `1px solid ${C.gray200}`,
          background: C.surface,
        }}>
          <div>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 18, color: '#EBEBEB', letterSpacing: '0.03em' }}>
              GERAR CRONOGRAMA COM IA ✨
            </div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
              Descreva os serviços ou envie um documento — a IA monta o cronograma completo
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6 }}
          >
            <Icon name="x" size={20} color="#888" />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* Mode tabs */}
          <div style={{
            display: 'flex',
            gap: 4,
            background: C.gray100,
            borderRadius: 8,
            padding: 4,
            marginBottom: 20,
          }}>
            {[
              { key: 'texto',     label: 'Descrever em texto',  icon: 'chat'   },
              { key: 'documento', label: 'Enviar documento',     icon: 'upload' },
            ].map(m => (
              <button
                key={m.key}
                onClick={() => { setMode(m.key); setError('') }}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: FONT_BODY,
                  fontSize: 13,
                  fontWeight: 600,
                  background: mode === m.key ? C.white : 'transparent',
                  color: mode === m.key ? C.orange : C.gray500,
                  boxShadow: mode === m.key ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                <Icon name={m.icon} size={14} color={mode === m.key ? C.orange : C.gray500} />
                {m.label}
              </button>
            ))}
          </div>

          {mode === 'texto' ? (
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.gray700, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                Descreva os serviços e durações estimadas
              </label>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder={`Exemplo:\n\nFundação em sapatas de concreto armado — 3 semanas\nVigas baldrame e arranques — 2 semanas\nPilares do térreo — 2 semanas\nLaje do térreo (fôrma, armação, concretagem, cura) — 4 semanas\nAlvenaria — 3 semanas\nCobertura — 2 semanas\n\nDuração total: ${weeks} semanas`}
                rows={10}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  fontFamily: FONT_BODY,
                  fontSize: 13,
                  padding: '12px 14px',
                  border: `1.5px solid ${C.gray200}`,
                  borderRadius: 8,
                  outline: 'none',
                  resize: 'vertical',
                  color: C.black,
                  background: C.white,
                  lineHeight: 1.6,
                }}
              />
            </div>
          ) : (
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.gray700, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                Arquivo (.txt, .md, .csv)
              </label>
              <div
                onClick={() => fileRef.current.click()}
                style={{
                  border: `2px dashed ${docName ? C.green : C.gray200}`,
                  borderRadius: 8,
                  padding: 20,
                  textAlign: 'center',
                  cursor: 'pointer',
                  marginBottom: 14,
                  background: docName ? C.greenLight : C.gray50,
                  transition: 'all 0.15s',
                }}
              >
                <Icon name={docName ? 'check' : 'upload'} size={28} color={docName ? C.green : C.gray300} style={{ margin: '0 auto 8px', display: 'block' }} />
                <div style={{ fontSize: 13, color: docName ? C.green : C.gray500, fontWeight: 600 }}>
                  {docName || 'Clique para selecionar arquivo'}
                </div>
                <div style={{ fontSize: 11, color: C.gray500, marginTop: 4 }}>
                  .txt, .md, .csv — Para PDF/Word, copie e cole abaixo
                </div>
              </div>
              <input ref={fileRef} type="file" accept=".txt,.md,.csv,.text" onChange={handleFile} style={{ display: 'none' }} />
              <label style={{ fontSize: 11, fontWeight: 700, color: C.gray700, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                Ou cole o conteúdo aqui
              </label>
              <textarea
                value={docText}
                onChange={e => setDocText(e.target.value)}
                placeholder="Cole o conteúdo do documento (cronograma, lista de serviços, memorial descritivo...)..."
                rows={8}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  fontFamily: FONT_BODY,
                  fontSize: 12,
                  padding: '10px 14px',
                  border: `1.5px solid ${C.gray200}`,
                  borderRadius: 8,
                  outline: 'none',
                  resize: 'vertical',
                  color: C.black,
                  background: C.white,
                  lineHeight: 1.5,
                }}
              />
            </div>
          )}

          {error && (
            <div style={{
              marginTop: 14,
              padding: '10px 14px',
              background: C.redLight,
              border: `1px solid ${C.red}`,
              borderRadius: 8,
              fontSize: 13,
              color: C.red,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <Icon name="warning" size={15} color={C.red} />
              {error}
            </div>
          )}

          {loading && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: C.gray500 }}>
              <Spinner size={32} />
              <div style={{ marginTop: 12, fontSize: 13 }}>Gerando cronograma com IA...</div>
              <div style={{ fontSize: 11, color: C.gray500, marginTop: 4 }}>pode levar alguns segundos</div>
            </div>
          )}

          {preview && !loading && (
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: C.black, letterSpacing: '0.04em' }}>
                  PRÉVIA DO CRONOGRAMA
                </div>
                <span style={{ fontSize: 11, background: C.greenLight, color: C.green, padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
                  {preview.length} atividades
                </span>
              </div>

              <div style={{ border: `1px solid ${C.gray200}`, borderRadius: 8, overflow: 'hidden' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 100px 60px 60px',
                  gap: 8,
                  padding: '6px 12px',
                  background: C.gray100,
                  fontSize: 10,
                  fontWeight: 700,
                  color: C.gray500,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}>
                  {['Atividade', 'Tipo', 'Início', 'Fim'].map((h, i) => <span key={i}>{h}</span>)}
                </div>

                {Object.entries(grouped).map(([grupo, acts]) => (
                  <div key={grupo}>
                    <div style={{
                      padding: '5px 12px',
                      background: C.surface,
                      color: '#EBEBEB',
                      fontSize: 11,
                      fontFamily: FONT_DISPLAY,
                      fontWeight: 700,
                      letterSpacing: '0.07em',
                      textTransform: 'uppercase',
                    }}>
                      {grupo}
                    </div>
                    {acts.map((act, i) => <PreviewActivity key={i} act={act} />)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: `1px solid ${C.gray200}`,
          display: 'flex',
          gap: 10,
          justifyContent: 'flex-end',
          background: C.gray50,
        }}>
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          {preview && !loading && (
            <Btn variant="secondary" icon="refresh" onClick={handleGenerate}>
              Gerar novamente
            </Btn>
          )}
          {preview && !loading ? (
            <Btn variant="primary" icon="check" onClick={handleAccept}>
              Usar este cronograma
            </Btn>
          ) : !loading && (
            <Btn variant="primary" icon="chat" onClick={handleGenerate}>
              Gerar cronograma
            </Btn>
          )}
        </div>
      </div>
    </div>
  )
}
