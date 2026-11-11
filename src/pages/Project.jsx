import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  fetchActivities,
  fetchMaterials,
  fetchRdos,
  fetchBaselines,
  fetchAiLogs,
  upsertActivities,
  updateActivityFields,
  createBaseline,
  updateProject,
  saveAiLog,
  deleteAiLog,
} from '../lib/supabase'
import { C, FONT_BODY, FONT_DISPLAY } from '../tokens'
import { SpLogo, Btn, Badge, KPI, ProgressBar, Spinner, Alert, Icon, ThemeToggle } from '../components/ui'
import Gantt, { calcCurrentWeek } from '../components/Gantt'
import SCurve from '../components/SCurve'
import EditActivities from '../features/EditActivities'
import Flowchart from '../features/Flowchart'
import Collaborators from '../features/Collaborators'
import Reports from '../features/Reports'
import VisuObra from '../features/VisuObra'
import MobileNav from '../components/MobileNav'
import useIsMobile from '../hooks/useIsMobile'

const TABS = [
  { key: 'cronograma',    label: 'Cronograma',     icon: 'calendar'      },
  { key: 'scurve',        label: 'Curva S',        icon: 'chart'         },
  { key: 'editar',        label: 'Editar',         icon: 'edit'          },
  { key: 'fluxo',         label: 'Fluxograma',     icon: 'flow'          },
  { key: 'colaboradores', label: 'Colaboradores',  icon: 'users'         },
  { key: 'visuobra',      label: 'VisuObra',        icon: 'camera'        },
  { key: 'relatorios',    label: 'Relatórios',     icon: 'file'          },
  { key: 'link',          label: 'Link Cliente',   icon: 'link'          },
]

// Mobile bottom nav — consistent with Dashboard (avatar center = volta ao dashboard)
const MOBILE_PROJ_NAV = [
  { key: 'obras',      icon: 'construction', label: 'Obras'      },
  { key: 'cronograma', icon: 'calendar',     label: 'Cronograma' },
  { key: 'fluxo',      icon: 'flow',         label: 'Fluxograma' },
  { key: 'relatorios', icon: 'file',         label: 'Relatórios' },
]

function Skeleton() {
  return (
    <div style={{ padding: '32px 24px', fontFamily: FONT_BODY }}>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{
          height: 20,
          background: C.gray200,
          borderRadius: 6,
          marginBottom: 12,
          width: `${60 + Math.random() * 30}%`,
          animation: 'pulse 1.2s ease-in-out infinite alternate',
        }} />
      ))}
      <style>{`@keyframes pulse{from{opacity:1}to{opacity:0.4}}`}</style>
    </div>
  )
}

export default function Project() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile } = useAuth()
  const isMobile = useIsMobile()

  const [project, setProject] = useState(null)
  const [activities, setActivities] = useState([])
  const [materials, setMaterials] = useState([])
  const [rdos, setRdos] = useState([])
  const [aiLogs, setAiLogs] = useState([])
  const [baselines, setBaselines] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState(location.state?.tab || 'cronograma')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const saveTimer = useRef(null)
  const baselineCreated = useRef(false)

  useEffect(() => {
    if (id) loadAll()
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [id])

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const [proj, acts, mats, rs, bls, logs] = await Promise.all([
        import('../lib/supabase').then(m => m.supabase.from('projects').select('*').eq('id', id).single()),
        fetchActivities(id),
        fetchMaterials(id),
        fetchRdos(id),
        fetchBaselines(id),
        fetchAiLogs(id),
      ])
      if (proj.error) throw proj.error
      setProject(proj.data)
      setActivities(acts.data || [])
      setMaterials(mats.data || [])
      setRdos(rs.data || [])
      setBaselines(bls.data || [])
      setAiLogs(logs.data || [])
      if ((bls.data || []).length > 0) baselineCreated.current = true
    } catch (err) {
      setError(err.message || 'Erro ao carregar projeto.')
    } finally {
      setLoading(false)
    }
  }

  async function handleActivitiesUpdate(updatedActivities) {
    // Update local state immediately for Gantt/SCurve preview
    setActivities(updatedActivities)

    // Persist to DB (called explicitly from editor Save button)
    setSaving(true)
    try {
      const toSave = updatedActivities
        .filter(a => a.name && a.name.trim())
        .map((a, i) => ({
          ...a,
          project_id: id,
          order_index: i,
        }))

      const { error: err } = await upsertActivities(toSave)
      if (err) throw err

      // Auto-create baseline on first save
      if (!baselineCreated.current && toSave.length > 0) {
        await createBaseline(id, toSave, 'Baseline Inicial')
        baselineCreated.current = true
        const { data } = await fetchBaselines(id)
        setBaselines(data || [])
      }

      // Recalculate overall_pct
      const named = updatedActivities.filter(a => a.name && a.name.trim())
      const pct = named.length
        ? Math.round(named.reduce((s, a) => s + (a.pct || 0), 0) / named.length)
        : 0
      await updateProject(id, { overall_pct: pct })
      setProject(p => p ? { ...p, overall_pct: pct } : p)

      setSaveMsg('Salvo')
      setTimeout(() => setSaveMsg(''), 2000)
    } catch (err) {
      setSaveMsg('Erro ao salvar')
      console.error('Save error:', err)
      throw err   // re-throw so EditActivities can catch and show its own error
    } finally {
      setSaving(false)
    }
  }

  // ─── Fluxograma handlers ──────────────────────────────────────────────────
  // Lightweight patch (position, dependências, status...) vindo do canvas —
  // já foi persistido no banco pelo próprio Flowchart; aqui só sincronizamos
  // o estado local para Gantt/Curva S/etc. refletirem na hora.
  function handleActivityPatch(activityId, patch) {
    setActivities(prev => prev.map(a => a.id === activityId ? { ...a, ...patch } : a))
  }

  function handleActivityCreated(newActivity) {
    setActivities(prev => [...prev, newActivity])
  }

  function handleActivityDeleted(activityId) {
    setActivities(prev => {
      const next = prev.filter(a => a.id !== activityId)
      // Remove a dependência de quem apontava para a etapa excluída
      next.forEach(a => {
        if ((a.predecessor_ids || []).includes(activityId)) {
          const predecessor_ids = a.predecessor_ids.filter(pid => pid !== activityId)
          updateActivityFields(a.id, { predecessor_ids }).catch(() => {})
          a.predecessor_ids = predecessor_ids
        }
      })
      return next
    })
  }

  async function handleSaveAiLog(logData) {
    try {
      const { data } = await saveAiLog({
        ...logData,
        project_id: id,
        user_id: user?.id,
      })
      if (data) setAiLogs(prev => [data, ...prev])
    } catch (err) {
      console.error('Erro ao salvar log IA', err)
    }
  }

  async function handleDeleteAiLog(logId) {
    try {
      await deleteAiLog(logId)
      setAiLogs(prev => prev.filter(l => l.id !== logId))
    } catch (err) {
      console.error('Erro ao excluir log IA', err)
    }
  }

  async function handleWeekChange(newWeek) {
    if (!project) return
    const updated = { ...project, current_week: newWeek }
    setProject(updated)
    await updateProject(id, { current_week: newWeek })
  }

  async function handleAddWeeks(n) {
    if (!project || !n || n <= 0) return
    const newWeeks = (project.weeks || 1) + n
    setProject(p => p ? { ...p, weeks: newWeeks } : p)
    try {
      await updateProject(id, { weeks: newWeeks })
    } catch (err) {
      console.error('Erro ao adicionar semanas:', err)
      setProject(p => p ? { ...p, weeks: project.weeks } : p)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.gray50, fontFamily: FONT_BODY }}>
        <div style={{ background: C.surface, height: 56, display: 'flex', alignItems: 'center', padding: '0 24px' }}>
          <SpLogo size={26} />
        </div>
        <div style={{ height: 3, background: C.orange }} />
        <Skeleton />
      </div>
    )
  }

  if (error || !project) {
    return (
      <div style={{ minHeight: '100vh', background: C.gray50, fontFamily: FONT_BODY }}>
        <div style={{ background: C.surface, height: 56 }} />
        <div style={{ padding: 32 }}>
          <Alert type="error">{error || 'Projeto não encontrado.'}</Alert>
          <Btn variant="secondary" icon="back" style={{ marginTop: 16 }} onClick={() => navigate('/dashboard')}>
            Voltar
          </Btn>
        </div>
      </div>
    )
  }

  const pct = project.overall_pct || 0
  const currentWeek = project.start_date
    ? calcCurrentWeek(project.start_date)
    : (project.current_week || 1)
  const totalWeeks = project.weeks || 1
  const atrasadas = activities.filter(a => a.status === 'atrasado').length
  const baseline = baselines.length > 0 ? baselines[0] : null

  return (
    <div style={{ minHeight: '100vh', background: C.gray50, fontFamily: FONT_BODY }}>
      {/* Header */}
      <header style={{
        background: C.surface,
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          height: 56,
        }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: C.onSurfaceMuted, display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 8px', borderRadius: 6,
            }}
          >
            <Icon name="back" size={16} color={C.gray400} />
            <span style={{ fontSize: 12, color: C.onSurfaceMuted }}>Dashboard</span>
          </button>

          <div style={{ width: 1, height: 24, background: C.gray700 }} />

          <SpLogo size={22} />

          <div style={{ width: 1, height: 24, background: C.gray700 }} />

          {!isMobile && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 800,
                fontSize: 15,
                color: C.onSurface,
                letterSpacing: '0.04em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {project.name}
              </div>
              {project.responsible && (
                <div style={{ fontSize: 11, color: C.onSurfaceMuted }}>{project.responsible}</div>
              )}
            </div>
          )}

          {/* KPIs */}
          <div style={{ display: 'flex', gap: isMobile ? 10 : 16, alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: isMobile ? 15 : 18, color: C.orange }}>
                S{currentWeek}
              </div>
              {!isMobile && (
                <div style={{ fontSize: 9, color: C.gray500, letterSpacing: '0.04em' }}>
                  /{totalWeeks}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: isMobile ? 15 : 18, color: C.onSurface }}>
                {pct}%
              </div>
              {!isMobile && (
                <div style={{ fontSize: 9, color: C.gray500, letterSpacing: '0.04em' }}>AVANÇO</div>
              )}
            </div>
            {atrasadas > 0 && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: isMobile ? 15 : 18, color: C.red }}>
                  {atrasadas}
                </div>
                {!isMobile && (
                  <div style={{ fontSize: 9, color: C.gray500, letterSpacing: '0.04em' }}>ATRASADAS</div>
                )}
              </div>
            )}
          </div>

          <ThemeToggle />

          {/* Save indicator */}
          {(saving || saveMsg) && (
            <div style={{
              fontSize: 11,
              color: saving ? C.gray400 : saveMsg.includes('Erro') ? C.red : C.green,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              {saving && <Spinner />}
              {!saving && saveMsg}
            </div>
          )}
        </div>

        {/* Progress bar strip */}
        <div style={{ height: 3, background: C.gray800 || '#2a2a2a' }}>
          <div style={{
            height: '100%',
            width: `${pct}%`,
            background: pct === 100 ? C.green : C.orange,
            transition: 'width 0.5s ease',
          }} />
        </div>

        {/* Tabs */}
        <nav style={{
          display: 'flex',
          gap: 0,
          overflowX: 'auto',
          borderTop: `1px solid ${C.gray800 || '#2a2a2a'}`,
        }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 16px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontFamily: FONT_BODY,
                fontWeight: 600,
                fontSize: 12,
                color: tab === t.key ? C.orange : C.gray500,
                borderBottom: `2px solid ${tab === t.key ? C.orange : 'transparent'}`,
                whiteSpace: 'nowrap',
                transition: 'color 0.15s, border-color 0.15s',
              }}
            >
              <Icon name={t.icon} size={13} color={tab === t.key ? C.orange : C.gray500} />
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 1400, margin: '0 auto', padding: isMobile ? '16px 12px' : '24px' }}>
        {tab === 'cronograma' && (
          <>
            <div style={{
              background: C.white,
              borderRadius: 10,
              border: `1px solid ${C.gray200}`,
              overflow: 'hidden',
            }}>
              <Gantt
                activities={activities}
                weeks={totalWeeks}
                currentWeek={currentWeek}
                startDate={project.start_date}
                materials={materials}
              />
            </div>
            {/* Floating edit button */}
            <button
              onClick={() => setTab('editar')}
              title="Editar atividades"
              style={{
                position: 'fixed',
                bottom: isMobile ? 80 : 32,
                right: 24,
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: C.orange,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(232,80,10,0.45)',
                zIndex: 100,
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(232,80,10,0.6)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(232,80,10,0.45)' }}
            >
              <Icon name="edit" size={22} color={C.white} />
            </button>
          </>
        )}

        {tab === 'scurve' && (
          <div style={{
            background: C.white,
            borderRadius: 10,
            border: `1px solid ${C.gray200}`,
            padding: '24px',
          }}>
            <SCurve
              activities={activities}
              baseline={baseline}
              currentWeek={currentWeek}
              weeks={totalWeeks}
            />
          </div>
        )}

        {tab === 'editar' && (
          <EditActivities
            activities={activities}
            weeks={totalWeeks}
            onUpdate={handleActivitiesUpdate}
            onAddWeeks={handleAddWeeks}
            startDate={project.start_date}
            currentWeek={currentWeek}
            projectId={id}
            userId={user?.id}
          />
        )}

        {tab === 'fluxo' && (
          <Flowchart
            projectId={id}
            userId={user?.id}
            project={project}
            activities={activities}
            materials={materials}
            currentWeek={currentWeek}
            aiLogs={aiLogs}
            onActivityPatch={handleActivityPatch}
            onActivityCreated={handleActivityCreated}
            onActivityDeleted={handleActivityDeleted}
            onSaveAiLog={handleSaveAiLog}
          />
        )}

        {tab === 'colaboradores' && (
          <Collaborators
            projectId={id}
            ownerId={project.owner_id}
            userId={user?.id}
          />
        )}

        {tab === 'visuobra' && (
          <VisuObra
            project={project}
            activities={activities}
            userId={user?.id}
            onProjectUpdate={(updated) => setProject(p => ({ ...p, ...updated }))}
          />
        )}

        {tab === 'relatorios' && (
          <Reports
            project={project}
            activities={activities}
            materials={materials}
            rdos={rdos}
            baselines={baselines}
            userId={user?.id}
          />
        )}

        {tab === 'link' && (
          <ClientLink project={project} />
        )}
      </main>

      {/* ── Mobile bottom nav ── */}
      <MobileNav
        items={MOBILE_PROJ_NAV}
        activeKey={tab}
        onSelect={key => {
          if (key === 'obras') navigate('/dashboard')
          else setTab(key)
        }}
        avatarUrl={profile?.avatar_url}
        userName={profile?.name || user?.email || ''}
        onAvatarPress={() => navigate('/dashboard')}
      />
    </div>
  )
}

function ClientLink({ project }) {
  const [copied, setCopied] = useState(false)
  const token = project.client_token
  const url = token ? `${window.location.origin}/client/${token}` : null

  function handleCopy() {
    if (!url) return
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{
      background: C.white,
      borderRadius: 10,
      border: `1px solid ${C.gray200}`,
      padding: '32px',
      maxWidth: 640,
    }}>
      <div style={{
        fontFamily: FONT_DISPLAY,
        fontWeight: 800,
        fontSize: 20,
        color: C.black,
        marginBottom: 8,
        letterSpacing: '0.03em',
      }}>
        LINK PARA O CLIENTE
      </div>
      <div style={{ color: C.gray500, fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
        Compartilhe este link com o cliente para que ele possa acompanhar o progresso da obra em tempo real, sem necessidade de login.
      </div>

      {token ? (
        <>
          <div style={{
            background: C.gray50,
            border: `1px solid ${C.gray200}`,
            borderRadius: 8,
            padding: '12px 16px',
            fontFamily: 'monospace',
            fontSize: 13,
            color: C.gray700,
            wordBreak: 'break-all',
            marginBottom: 16,
          }}>
            {url}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn
              variant="primary"
              icon={copied ? 'check' : 'copy'}
              onClick={handleCopy}
            >
              {copied ? 'Copiado!' : 'Copiar link'}
            </Btn>
            <Btn
              variant="secondary"
              icon="eye"
              onClick={() => window.open(url, '_blank')}
            >
              Visualizar
            </Btn>
          </div>
        </>
      ) : (
        <Alert type="warning">
          Este projeto não possui um token de cliente. Aguarde a geração automática ou contate o suporte.
        </Alert>
      )}
    </div>
  )
}
