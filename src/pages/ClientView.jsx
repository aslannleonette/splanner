import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { C, FONT_BODY, FONT_DISPLAY, STATUS_MAT, TIPO_CFG } from '../tokens'
import { fetchVisuPhotos, getVisuPhotoUrl } from '../lib/visuobra'

// Fetch anônimo direto ao REST API — sem GoTrueClient, sem JWT expirado
const _SUPA_URL = import.meta.env.VITE_SUPABASE_URL
const _SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const _ANON_HDR = { apikey: _SUPA_KEY, Authorization: `Bearer ${_SUPA_KEY}` }
async function anonGet(path) {
  const r = await fetch(`${_SUPA_URL}/rest/v1/${path}`, { headers: _ANON_HDR })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}
import Gantt, { calcCurrentWeek } from '../components/Gantt'
import SCurve from '../components/SCurve'
import { ProgressBar, Badge, Icon, Spinner } from '../components/ui'

function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = item[key] || 'Geral'
    if (!acc[k]) acc[k] = []
    acc[k].push(item)
    return acc
  }, {})
}

function EtapaCard({ name, activities }) {
  const namedActs = activities.filter(a => a.name)
  const avg = namedActs.length
    ? Math.round(namedActs.reduce((s, a) => s + (a.pct || 0), 0) / namedActs.length)
    : 0
  const concluidas = namedActs.filter(a => a.pct === 100).length
  const atrasadas = namedActs.filter(a => a.status === 'atrasado').length

  return (
    <div style={{
      background: C.white,
      border: `1px solid ${C.gray200}`,
      borderRadius: 12,
      padding: '18px 20px',
      fontFamily: FONT_BODY,
    }}>
      <div style={{
        fontFamily: FONT_DISPLAY,
        fontWeight: 700,
        fontSize: 13,
        color: C.black,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        marginBottom: 10,
        minHeight: 36,
      }}>
        {name}
      </div>

      <div style={{
        fontFamily: FONT_DISPLAY,
        fontWeight: 800,
        fontSize: 36,
        color: avg === 100 ? C.green : C.orange,
        lineHeight: 1,
        marginBottom: 8,
      }}>
        {avg}%
      </div>

      <ProgressBar pct={avg} color={avg === 100 ? C.green : C.orange} height={6} />

      <div style={{
        display: 'flex',
        gap: 12,
        marginTop: 10,
        fontSize: 11,
        color: C.gray500,
      }}>
        <span>{namedActs.length} atividade(s)</span>
        <span style={{ color: C.green }}>{concluidas} concluída(s)</span>
        {atrasadas > 0 && (
          <span style={{ color: C.red }}>{atrasadas} atrasada(s)</span>
        )}
      </div>
    </div>
  )
}

function MaterialRow({ mat }) {
  const sc = STATUS_MAT[mat.status] || STATUS_MAT.pendente
  const pctRec = mat.quantity > 0 && mat.received_qty != null
    ? Math.min(100, Math.round((mat.received_qty / mat.quantity) * 100))
    : 0
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '10px 14px',
      borderBottom: `1px solid ${C.gray100}`,
      background: C.white,
    }}>
      <div style={{
        width: 28, height: 28,
        background: sc.bg,
        borderRadius: 7,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon name={sc.icon} size={12} color={sc.cor} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.black }}>{mat.name}</div>
        {mat.group_name && (
          <div style={{ fontSize: 11, color: C.gray400, marginTop: 1 }}>{mat.group_name}</div>
        )}
      </div>
      <div style={{ textAlign: 'right', minWidth: 70 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.black }}>
          {mat.quantity} {mat.unit}
        </div>
        <div style={{ fontSize: 10, color: C.gray400 }}>S{mat.week}</div>
      </div>
      {mat.received_qty != null && (
        <div style={{ width: 60 }}>
          <ProgressBar pct={pctRec} color={pctRec === 100 ? C.green : sc.cor} height={4} />
          <div style={{ fontSize: 9, color: C.gray400, textAlign: 'right', marginTop: 2 }}>
            {pctRec}%
          </div>
        </div>
      )}
      <Badge label={sc.label} cor={sc.cor} bg={sc.bg} />
    </div>
  )
}

function TabBar({ active, onChange }) {
  const tabs = [
    { id: 'visao_geral', label: 'Visão Geral', icon: 'chart' },
    { id: 'cronograma', label: 'Cronograma', icon: 'calendar' },
    { id: 'curva_s',    label: 'Curva S',     icon: 'trending' },
    { id: 'materiais',  label: 'Materiais',   icon: 'box' },
    { id: 'fotos',      label: 'Fotos',        icon: 'camera' },
  ]
  return (
    <div style={{
      display: 'flex',
      gap: 4,
      padding: '0 24px',
      background: '#1A1A2A',
      borderBottom: '1px solid rgba(255,255,255,0.1)',
      overflowX: 'auto',
    }}>
      {tabs.map(tab => {
        const isActive = active === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '12px 16px',
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: FONT_BODY, fontWeight: isActive ? 700 : 500,
              fontSize: 13,
              color: isActive ? C.orange : '#9ca3af',
              borderBottom: isActive ? `2px solid ${C.orange}` : '2px solid transparent',
              marginBottom: -1,
              whiteSpace: 'nowrap',
              transition: 'color 0.15s',
            }}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export default function ClientView() {
  const { token } = useParams()
  const [project, setProject] = useState(null)
  const [activities, setActivities] = useState([])
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('visao_geral')
  const [photos, setPhotos] = useState([])
  const [baselines, setBaselines] = useState([])

  useEffect(() => {
    if (token) loadData()
  }, [token])

  async function loadData() {
    setLoading(true)
    try {
      const projArr = await anonGet(`projects?client_token=eq.${token}&select=*&limit=1`)
      const proj = projArr?.[0]
      if (!proj) throw new Error('Projeto não encontrado ou link inválido.')
      setProject(proj)

      const [acts, mats, bls] = await Promise.all([
        anonGet(`activities?project_id=eq.${proj.id}&select=*&order=order_index.asc`),
        anonGet(`materials?project_id=eq.${proj.id}&select=*&order=week.asc`),
        anonGet(`baselines?project_id=eq.${proj.id}&select=*&order=created_at.asc`),
      ])
      setActivities(acts || [])
      setMaterials(mats || [])
      setBaselines(bls || [])

      // Load VisuObra photos if linked
      if (proj.visuobra_obra_id) {
        const { data: visuPics } = await fetchVisuPhotos(proj.visuobra_obra_id)
        setPhotos((visuPics || []).map(p => ({
          ...p, url: getVisuPhotoUrl(p.image_path),
          caption: p.titulo || p.descricao || null,
        })))
      }
    } catch (err) {
      setError(err.message || 'Erro ao carregar projeto.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: C.black,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        fontFamily: FONT_BODY,
      }}>
        <Spinner />
        <div style={{ color: C.gray400, fontSize: 14 }}>Carregando...</div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div style={{
        minHeight: '100vh',
        background: C.black,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: FONT_BODY,
        textAlign: 'center',
      }}>
        <Icon name="warning" size={48} color={C.red} style={{ marginBottom: 16 }} />
        <div style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 800,
          fontSize: 22,
          color: C.white,
          marginBottom: 8,
        }}>
          LINK INVÁLIDO
        </div>
        <div style={{ color: C.gray400, fontSize: 14, maxWidth: 340 }}>
          {error || 'Este link não é válido ou a obra não está disponível.'}
        </div>
        <div style={{ marginTop: 24, color: C.gray600, fontSize: 12 }}>
          Splanner · Leonette Engenharia
        </div>
      </div>
    )
  }

  const namedActs = activities.filter(a => a.name)
  const pct = namedActs.length
    ? Math.round(namedActs.reduce((s, a) => s + (a.pct || 0), 0) / namedActs.length)
    : 0

  // ── Semana atual calculada dinamicamente a partir da data de início ──
  const currentWeek = project.start_date
    ? Math.min(calcCurrentWeek(project.start_date), project.weeks || 1)
    : (project.current_week || 1)

  const totalWeeks = project.weeks || 1
  const weekPct = Math.round((currentWeek / totalWeeks) * 100)

  // ── Baseline para Curva S (mesmo que o sistema interno) ──
  const baseline = baselines.length > 0 ? baselines[0] : null

  const groups = groupBy(namedActs, 'group_name')
  const matsByWeek = materials.reduce((acc, m) => {
    const k = m.week || 0
    if (!acc[k]) acc[k] = []
    acc[k].push(m)
    return acc
  }, {})

  return (
    <div data-theme="light" style={{ minHeight: '100vh', background: '#F9F9F9', fontFamily: FONT_BODY }}>
      {/* Hero header */}
      <div style={{ background: '#1A1A2A', padding: '0' }}>
        {/* Orange bar */}
        <div style={{ height: 4, background: C.orange }} />

        <div style={{ padding: '32px 32px 0' }}>
          {/* Splanner badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: C.gray900,
            padding: '4px 12px',
            borderRadius: 20,
            marginBottom: 24,
          }}>
            <svg width={16} height={16} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', borderRadius: 3, flexShrink: 0 }}>
              <rect width="100" height="100" fill="#E8500A"/>
              <rect x="45" y="14" width="55" height="21" fill="#fff"/>
              <rect x="10" y="40" width="65" height="21" fill="#fff"/>
              <rect x="0"  y="66" width="50" height="21" fill="#fff"/>
            </svg>
            <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, color: C.gray300, letterSpacing: '0.1em' }}>
              SPLANNER
            </span>
          </div>

          {/* Project name */}
          <h1 style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 900,
            fontSize: 'clamp(24px, 4vw, 42px)',
            color: C.white,
            margin: '0 0 8px',
            letterSpacing: '0.02em',
            lineHeight: 1.1,
          }}>
            {project.name}
          </h1>

          {/* Meta */}
          <div style={{
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            marginBottom: 32,
            color: C.gray400,
            fontSize: 13,
          }}>
            {project.responsible && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Icon name="users" size={13} color={C.gray500} />
                {project.responsible}
              </span>
            )}
            {project.area && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Icon name="construction" size={13} color={C.gray500} />
                {project.area}
              </span>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Icon name="calendar" size={13} color={C.gray500} />
              Semana {currentWeek} de {totalWeeks}
            </span>
          </div>

          {/* Big advance number */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 16,
            marginBottom: 24,
            flexWrap: 'wrap',
          }}>
            <div>
              <div style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 900,
                fontSize: 'clamp(56px, 10vw, 96px)',
                color: pct === 100 ? C.green : C.orange,
                lineHeight: 0.9,
              }}>
                {pct}%
              </div>
              <div style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 600,
                fontSize: 14,
                color: C.gray400,
                letterSpacing: '0.1em',
                marginTop: 8,
              }}>
                AVANÇO FÍSICO GERAL
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 240, paddingBottom: 8 }}>
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 11, color: C.gray500 }}>Progresso do cronograma</span>
                  <span style={{ fontSize: 11, color: C.gray400 }}>{currentWeek}/{totalWeeks} semanas</span>
                </div>
                <ProgressBar pct={weekPct} color={C.gray500} height={4} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 11, color: C.gray500 }}>Avanço físico</span>
                  <span style={{ fontSize: 11, color: pct === 100 ? C.green : C.orange }}>{pct}%</span>
                </div>
                <ProgressBar pct={pct} color={pct === 100 ? C.green : C.orange} height={8} />
              </div>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <TabBar active={activeTab} onChange={setActiveTab} />
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px 48px' }}>

        {/* ── Visão Geral ── */}
        {activeTab === 'visao_geral' && (
          <>
            {Object.keys(groups).length > 0 && (
              <section style={{ marginBottom: 40 }}>
                <div style={{
                  fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 20,
                  color: C.black, letterSpacing: '0.04em', marginBottom: 16,
                }}>
                  ETAPAS DA OBRA
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: 14,
                }}>
                  {Object.entries(groups).map(([name, acts]) => (
                    <EtapaCard key={name} name={name} activities={acts} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* ── Cronograma ── */}
        {activeTab === 'cronograma' && activities.length > 0 && (
          <section style={{ marginBottom: 40 }}>
            <div style={{
              fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 20,
              color: C.black, letterSpacing: '0.04em', marginBottom: 16,
            }}>
              CRONOGRAMA
            </div>
            <div style={{
              background: C.white,
              border: `1px solid ${C.gray200}`,
              borderRadius: 12,
              overflow: 'hidden',
            }}>
              <Gantt
                activities={activities}
                weeks={totalWeeks}
                currentWeek={currentWeek}
                startDate={project.start_date || null}
                materials={materials}
              />
            </div>
          </section>
        )}

        {/* ── Curva S ── */}
        {activeTab === 'curva_s' && (
          <section style={{ marginBottom: 40 }}>
            <div style={{
              fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 20,
              color: C.black, letterSpacing: '0.04em', marginBottom: 16,
            }}>
              CURVA S
            </div>
            <div style={{
              background: C.white,
              border: `1px solid ${C.gray200}`,
              borderRadius: 12,
              padding: '20px 24px',
            }}>
              <SCurve
                activities={namedActs}
                baseline={baseline}
                currentWeek={currentWeek}
                weeks={totalWeeks}
              />
            </div>
          </section>
        )}

        {/* ── Materiais ── */}
        {activeTab === 'materiais' && materials.length > 0 && (
          <section style={{ marginBottom: 40 }}>
            <div style={{
              fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 20,
              color: C.black, letterSpacing: '0.04em', marginBottom: 16,
            }}>
              MATERIAIS
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {Object.entries(STATUS_MAT).map(([key, val]) => {
                const count = materials.filter(m => m.status === key).length
                if (count === 0) return null
                return (
                  <div key={key} style={{
                    padding: '4px 12px',
                    background: val.bg,
                    color: val.cor,
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}>
                    <Icon name={val.icon} size={11} color={val.cor} />
                    {val.label}: {count}
                  </div>
                )
              })}
            </div>

            <div style={{
              background: C.white,
              border: `1px solid ${C.gray200}`,
              borderRadius: 12,
              overflow: 'hidden',
            }}>
              {Object.entries(matsByWeek).sort(([a], [b]) => Number(a) - Number(b)).map(([week, mats]) => (
                <div key={week}>
                  <div style={{
                    padding: '6px 14px',
                    background: C.gray100,
                    borderBottom: `1px solid ${C.gray200}`,
                    fontFamily: FONT_DISPLAY,
                    fontWeight: 700,
                    fontSize: 11,
                    color: C.gray700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}>
                    Semana {week}
                  </div>
                  {mats.map(mat => (
                    <MaterialRow key={mat.id} mat={mat} />
                  ))}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Fotos VisuObra */}
        {activeTab === 'fotos' && (
          <section style={{ padding: '32px 32px 40px' }}>
            <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 20,
              color: '#1a1a2e', margin: '0 0 20px', letterSpacing: '0.02em' }}>
              📸 FOTOS DA OBRA
            </h2>
            {photos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 24px', color: '#9ca3af',
                border: '1px dashed #e5e7eb', borderRadius: 12 }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📷</div>
                Nenhuma foto registrada para esta obra.
              </div>
            ) : (
              <div style={{ display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                {photos.map((photo, idx) => (
                  <div key={photo.id || idx} style={{
                    aspectRatio: '4/3', borderRadius: 10, overflow: 'hidden',
                    background: '#f3f4f6', cursor: 'pointer',
                  }}>
                    <img
                      src={photo.url}
                      alt={photo.caption || ''}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Empty states */}
        {activeTab === 'cronograma' && activities.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: C.gray400 }}>
            Nenhuma atividade cadastrada.
          </div>
        )}
        {activeTab === 'materiais' && materials.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: C.gray400 }}>
            Nenhum material cadastrado.
          </div>
        )}
      </div>

      {/* Footer */}
      <footer style={{
        background: C.black,
        padding: '20px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div style={{ color: C.gray500, fontSize: 12 }}>
          {project.responsible && (
            <span>Responsável técnico: <strong style={{ color: C.gray300 }}>{project.responsible}</strong></span>
          )}
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: C.gray500,
          fontSize: 12,
        }}>
          <span>Monitorado por</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width={18} height={18} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', borderRadius: 3, flexShrink: 0 }}>
              <rect width="100" height="100" fill="#E8500A"/>
              <rect x="45" y="14" width="55" height="21" fill="#fff"/>
              <rect x="10" y="40" width="65" height="21" fill="#fff"/>
              <rect x="0"  y="66" width="50" height="21" fill="#fff"/>
            </svg>
            <span style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 800,
              fontSize: 13,
              color: C.gray300,
              letterSpacing: '0.1em',
            }}>
              SPLANNER
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
