import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  fetchProjects,
  fetchCollabProjects,
  createProject,
  updateProject,
  signOut,
} from '../lib/supabase'
import { C, FONT_BODY, FONT_DISPLAY, GRUPOS_PADRAO } from '../tokens'
import {
  SpLogo, Btn, Badge, KPI, ProgressBar, Modal,
  Input, Select, Spinner, Alert, Icon, ThemeToggle,
} from '../components/ui'
import { calcCurrentWeek } from '../components/Gantt'
import MobileNav from '../components/MobileNav'
import UserProfile from '../features/UserProfile'
import useIsMobile from '../hooks/useIsMobile'

const AREAS = [
  'Estrutural', 'Hidrossanitário', 'Elétrico', 'Pavimentação',
  'Drenagem', 'Saneamento', 'Terraplenagem', 'Arquitetura', 'Outro',
]

const STATUS_OPTS = [
  { value: 'ativo',     label: 'Ativo'     },
  { value: 'pausado',   label: 'Pausado'   },
  { value: 'concluido', label: 'Concluído' },
  { value: 'atrasado',  label: 'Atrasado'  },
  { value: 'planejado', label: 'Planejado' },
]

const STATUS_COLOR = {
  ativo:     { bg: C.greenLight,  cor: C.green  },
  pausado:   { bg: C.amberLight,  cor: C.amber  },
  concluido: { bg: C.blueLight,   cor: C.blue   },
  atrasado:  { bg: C.redLight,    cor: C.red    },
  planejado: { bg: C.gray100,     cor: C.gray500 },
}

const EMPTY_FORM = { name: '', responsible: '', area: '', start_date: '', weeks: 20, status: 'ativo' }

// Mobile nav items (avatar in center is Perfil shortcut)
const MOBILE_NAV_ITEMS = [
  { key: 'obras',      icon: 'construction', label: 'Obras'      },
  { key: 'cronograma', icon: 'calendar',     label: 'Cronograma' },
  { key: 'materiais',  icon: 'package',      label: 'Materiais'  },
  { key: 'relatorios', icon: 'file',         label: 'Relatórios' },
]

function ProjectCard({ project, onClick, onEdit }) {
  const [hovered, setHovered] = useState(false)
  const pct = project.overall_pct || 0
  const status = project.status || 'ativo'
  const sc = STATUS_COLOR[status] || STATUS_COLOR.ativo
  const weeks = project.weeks || 1
  const cur = project.start_date
    ? Math.min(calcCurrentWeek(project.start_date), weeks)
    : (project.current_week || 1)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: C.white,
        border: `1.5px solid ${hovered ? C.orange : C.gray200}`,
        borderRadius: 12, padding: '18px 20px', cursor: 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: hovered ? '0 4px 20px rgba(232,80,10,0.12)' : '0 1px 4px rgba(0,0,0,0.05)',
        display: 'flex', flexDirection: 'column', gap: 12, fontFamily: FONT_BODY,
        position: 'relative',
      }}
      onClick={onClick}
    >
      <button
        onClick={e => { e.stopPropagation(); onEdit(project) }}
        title="Editar obra"
        style={{
          position: 'absolute', top: 12, right: 12,
          background: hovered ? C.gray100 : 'transparent',
          border: `1px solid ${hovered ? C.gray300 : 'transparent'}`,
          borderRadius: 6, cursor: 'pointer', padding: '4px 6px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s',
          zIndex: 1,
        }}
      >
        <Icon name="edit" size={13} color={C.gray500} />
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, paddingRight: 28 }}>
        <div>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 16, color: C.black, lineHeight: 1.2 }}>
            {project.name}
          </div>
          {project.responsible && (
            <div style={{ fontSize: 12, color: C.gray500, marginTop: 3 }}>
              Resp.: {project.responsible}
            </div>
          )}
        </div>
        <Badge label={status.charAt(0).toUpperCase() + status.slice(1)} cor={sc.cor} bg={sc.bg} />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {project.area && (
          <span style={{ fontSize: 11, color: C.gray700, background: C.gray100, padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
            {project.area}
          </span>
        )}
        <span style={{ fontSize: 11, color: C.gray500, background: C.gray50, padding: '2px 8px', borderRadius: 12 }}>
          Sem {cur}/{weeks}
        </span>
        {project.start_date && (
          <span style={{ fontSize: 11, color: C.gray500, background: C.gray50, padding: '2px 8px', borderRadius: 12 }}>
            Início: {new Date(project.start_date + 'T12:00:00').toLocaleDateString('pt-BR')}
          </span>
        )}
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontSize: 11, color: C.gray500 }}>Progresso da obra</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: pct === 100 ? C.green : C.orange }}>{pct}%</span>
        </div>
        <ProgressBar pct={pct} color={pct === 100 ? C.green : C.orange} height={6} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontSize: 10, color: C.gray300 }}>0%</span>
          <span style={{ fontSize: 10, color: C.gray300 }}>100%</span>
        </div>
      </div>

      <Btn variant="primary" size="sm" icon="arrow" style={{ alignSelf: 'flex-start', marginTop: 2 }}
        onClick={e => { e.stopPropagation(); onClick() }}>
        Abrir
      </Btn>
    </div>
  )
}

function ProjectForm({ form, setForm, onSubmit, onCancel, error, loading, isEdit }) {
  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {error && <Alert type="error">{error}</Alert>}

      <div>
        <label style={formLabelStyle}>Nome da obra *</label>
        <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Construção de muro de arrimo" required />
      </div>

      <div>
        <label style={formLabelStyle}>Responsável técnico</label>
        <Input value={form.responsible} onChange={e => setForm(f => ({ ...f, responsible: e.target.value }))} placeholder="Nome do engenheiro / técnico" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={formLabelStyle}>Área</label>
          <Select value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))}>
            <option value="">Selecionar...</option>
            {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
          </Select>
        </div>
        <div>
          <label style={formLabelStyle}>Status</label>
          <Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
            {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={formLabelStyle}>Data de início *</label>
          <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} required />
          <div style={{ fontSize: 10, color: C.gray500, marginTop: 3 }}>A Semana 1 começa na segunda-feira desta data</div>
        </div>
        <div>
          <label style={formLabelStyle}>Duração (semanas)</label>
          <Input type="number" min={1} max={200} value={form.weeks} onChange={e => setForm(f => ({ ...f, weeks: parseInt(e.target.value) || 1 }))} required />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
        <Btn type="button" variant="secondary" onClick={onCancel}>Cancelar</Btn>
        <Btn type="submit" variant="primary" icon={isEdit ? 'check' : 'plus'} disabled={loading}>
          {loading ? (isEdit ? 'Salvando...' : 'Criando...') : (isEdit ? 'Salvar alterações' : 'Criar obra')}
        </Btn>
      </div>
    </form>
  )
}

export default function Dashboard() {
  const { user, profile: authProfile, loading: authLoading } = useAuth()
  const navigate  = useNavigate()
  const isMobile  = useIsMobile()

  // Local profile state (updated when user edits in UserProfile)
  const [localProfile, setLocalProfile] = useState(null)
  const profile = localProfile || authProfile

  const [activeSection, setActiveSection] = useState('obras') // 'obras' | 'perfil'

  const [projects, setProjects]     = useState([])
  const [collabs,  setCollabs]      = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError]           = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [creating,   setCreating]   = useState(false)
  const [formError,  setFormError]  = useState('')
  const [form,       setForm]       = useState(EMPTY_FORM)

  const [editProject, setEditProject] = useState(null)
  const [editing,     setEditing]     = useState(false)
  const [editError,   setEditError]   = useState('')
  const [editForm,    setEditForm]    = useState(EMPTY_FORM)

  // Drag-to-reorder
  const [projectOrder, setProjectOrder] = useState(() => {
    try { return JSON.parse(localStorage.getItem('splanner_project_order') || '[]') } catch { return [] }
  })
  const [dragId,   setDragId]   = useState(null)
  const [dragOver, setDragOver] = useState(null)

  function getSortedProjects() {
    if (!projectOrder.length) return projects
    return [...projects].sort((a, b) => {
      const ia = projectOrder.indexOf(a.id)
      const ib = projectOrder.indexOf(b.id)
      if (ia === -1 && ib === -1) return 0
      if (ia === -1) return 1
      if (ib === -1) return -1
      return ia - ib
    })
  }

  function handleDragDrop(targetId) {
    if (!dragId || dragId === targetId) { setDragId(null); setDragOver(null); return }
    const ids = getSortedProjects().map(p => p.id)
    const from = ids.indexOf(dragId)
    const to   = ids.indexOf(targetId)
    if (from === -1 || to === -1) return
    ids.splice(from, 1)
    ids.splice(to, 0, dragId)
    setProjectOrder(ids)
    localStorage.setItem('splanner_project_order', JSON.stringify(ids))
    setDragId(null)
    setDragOver(null)
  }

  useEffect(() => { if (user) loadData() }, [user])
  // Sync authProfile into localProfile once it loads
  useEffect(() => { if (authProfile && !localProfile) setLocalProfile(authProfile) }, [authProfile])

  async function loadData() {
    setLoadingData(true)
    try {
      const [p, c] = await Promise.all([fetchProjects(user.id), fetchCollabProjects(user.id)])
      if (p.error) throw p.error
      if (c.error) throw c.error
      setProjects(p.data || [])
      setCollabs(c.data || [])
    } catch (err) {
      setError(err.message || 'Erro ao carregar projetos.')
    } finally {
      setLoadingData(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.name.trim())  { setFormError('Nome da obra é obrigatório.'); return }
    if (!form.start_date)   { setFormError('Data de início é obrigatória.'); return }
    if (!form.weeks || form.weeks < 1) { setFormError('Informe o número de semanas.'); return }
    setFormError('')
    setCreating(true)
    try {
      const { data, error: err } = await createProject({
        ...form,
        weeks:        Number(form.weeks),
        owner_id:     user.id,
        current_week: calcCurrentWeek(form.start_date),
        overall_pct:  0,
      })
      if (err) throw err
      setShowCreate(false)
      setForm(EMPTY_FORM)
      navigate(`/project/${data.id}`)
    } catch (err) {
      setFormError(err.message || 'Erro ao criar projeto.')
    } finally {
      setCreating(false)
    }
  }

  function openEdit(project) {
    setEditProject(project)
    setEditForm({
      name:        project.name        || '',
      responsible: project.responsible || '',
      area:        project.area        || '',
      start_date:  project.start_date  || '',
      weeks:       project.weeks       || 20,
      status:      project.status      || 'ativo',
    })
    setEditError('')
  }

  async function handleEdit(e) {
    e.preventDefault()
    if (!editForm.name.trim())  { setEditError('Nome obrigatório.'); return }
    if (!editForm.start_date)   { setEditError('Data de início obrigatória.'); return }
    setEditError('')
    setEditing(true)
    try {
      const current_week = Math.min(
        calcCurrentWeek(editForm.start_date),
        Number(editForm.weeks) || 20
      )
      const { error: err } = await updateProject(editProject.id, {
        ...editForm,
        weeks: Number(editForm.weeks),
        current_week,
      })
      if (err) throw err
      setProjects(ps => ps.map(p => p.id === editProject.id
        ? { ...p, ...editForm, weeks: Number(editForm.weeks), current_week }
        : p
      ))
      setEditProject(null)
    } catch (err) {
      setEditError(err.message || 'Erro ao salvar.')
    } finally {
      setEditing(false)
    }
  }

  async function handleLogout() {
    await signOut()
    navigate('/')
  }

  function handleMobileNav(key) {
    if (key === 'obras') {
      setActiveSection('obras')
    } else if (key === 'cronograma' || key === 'materiais' || key === 'relatorios') {
      // Navigate to the first project with that tab pre-selected
      const firstProject = projects[0]
      if (firstProject) {
        navigate(`/project/${firstProject.id}`, { state: { tab: key } })
      } else {
        // No projects yet — open create modal
        setShowCreate(true)
      }
    }
  }

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.surface }}>
        <Spinner />
      </div>
    )
  }

  const totalProjects     = projects.length
  const activeProjects    = projects.filter(p => p.status === 'ativo').length
  const completedProjects = projects.filter(p => p.status === 'concluido').length
  const pausedProjects    = projects.filter(p => p.status === 'pausado').length

  return (
    <div style={{ minHeight: '100vh', background: C.gray50, fontFamily: FONT_BODY }}>

      {/* ── Header ── */}
      <header style={{
        background: C.surface,
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 56,
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <SpLogo size={26} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Desktop: show name + profile button */}
          {!isMobile && (
            <>
              <span style={{ color: C.onSurfaceMuted, fontSize: 13, fontWeight: 500 }}>
                {profile?.name || user?.email || ''}
              </span>

              {/* Avatar / profile button */}
              <button
                onClick={() => setActiveSection(s => s === 'perfil' ? 'obras' : 'perfil')}
                title="Meu Perfil"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  border: `2px solid ${activeSection === 'perfil' ? C.orange : C.gray700}`,
                  background: profile?.avatar_url ? 'transparent' : C.orange,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  padding: 0,
                  outline: 'none',
                  transition: 'border-color 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 13, color: '#fff', userSelect: 'none' }}>
                    {(profile?.name || user?.email || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                )}
              </button>
            </>
          )}

          <ThemeToggle />

          {!isMobile && (
            <Btn variant="ghost" icon="logout" size="sm" style={{ color: C.onSurfaceMuted }} onClick={handleLogout}>
              Sair
            </Btn>
          )}
        </div>
      </header>

      <div style={{ height: 3, background: C.orange }} />

      {/* ── Desktop tab bar (Profile toggle) ── */}
      {!isMobile && (
        <div style={{
          background: C.surface,
          borderBottom: `1px solid rgba(255,255,255,0.06)`,
          display: 'flex',
          gap: 0,
          paddingLeft: 24,
        }}>
          {[
            { key: 'obras', label: 'Painel de obras', icon: 'construction' },
            { key: 'perfil', label: 'Meu perfil',     icon: 'user'         },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveSection(tab.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '10px 18px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontFamily: FONT_BODY,
                fontWeight: 600,
                fontSize: 13,
                color: activeSection === tab.key ? C.orange : C.onSurfaceMuted,
                borderBottom: `2px solid ${activeSection === tab.key ? C.orange : 'transparent'}`,
                whiteSpace: 'nowrap',
                transition: 'color 0.15s, border-color 0.15s',
              }}
            >
              <Icon name={tab.icon} size={14} color={activeSection === tab.key ? C.orange : C.onSurfaceMuted} />
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Content ── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '24px 16px' : '32px 24px' }}>

        {/* ─── Perfil section ─── */}
        {activeSection === 'perfil' && (
          <UserProfile
            user={user}
            profile={profile}
            onUpdate={updated => setLocalProfile(updated)}
          />
        )}

        {/* ─── Obras section ─── */}
        {activeSection === 'obras' && (
          <>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 28,
              flexWrap: 'wrap',
              gap: 16,
            }}>
              <div>
                <h1 style={{
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 800,
                  fontSize: isMobile ? 22 : 28,
                  color: C.black,
                  margin: 0,
                  letterSpacing: '0.02em',
                }}>
                  PAINEL DE OBRAS
                </h1>
                <div style={{ color: C.gray500, fontSize: 13, marginTop: 4 }}>
                  {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              </div>
              {!isMobile && (
                <Btn variant="primary" icon="plus" onClick={() => setShowCreate(true)}>Nova obra</Btn>
              )}
            </div>

            {error && <div style={{ marginBottom: 20 }}><Alert type="error">{error}</Alert></div>}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 32 }}>
              <KPI label="Total de obras" val={totalProjects} />
              <KPI label="Ativas"         val={activeProjects} accent />
              <KPI label="Concluídas"     val={completedProjects} />
              <KPI label="Pausadas"       val={pausedProjects} />
              <KPI label="Colaborações"   val={collabs.length} />
            </div>

            {/* Minhas obras */}
            <div style={{ marginBottom: 40 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: C.black, letterSpacing: '0.03em' }}>MINHAS OBRAS</div>
                <span style={{ fontSize: 11, color: C.gray500, background: C.gray100, padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>{projects.length}</span>
              </div>

              {loadingData ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '40px 0', color: C.gray500 }}>
                  <Spinner /><span style={{ fontSize: 14 }}>Carregando obras...</span>
                </div>
              ) : projects.length === 0 ? (
                <div style={{ background: C.white, border: `2px dashed ${C.gray200}`, borderRadius: 12, padding: '48px 24px', textAlign: 'center' }}>
                  <Icon name="construction" size={48} color={C.gray300} style={{ margin: '0 auto 12px' }} />
                  <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: C.gray500, marginBottom: 8 }}>NENHUMA OBRA CADASTRADA</div>
                  <div style={{ color: C.gray500, fontSize: 14, marginBottom: 20 }}>Crie sua primeira obra para começar a usar o Splanner.</div>
                  <Btn variant="primary" icon="plus" onClick={() => setShowCreate(true)}>Criar primeira obra</Btn>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                  {getSortedProjects().map(p => (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={() => setDragId(p.id)}
                      onDragEnter={() => setDragOver(p.id)}
                      onDragOver={e => e.preventDefault()}
                      onDrop={() => handleDragDrop(p.id)}
                      onDragEnd={() => { setDragId(null); setDragOver(null) }}
                      style={{
                        opacity: dragId === p.id ? 0.45 : 1,
                        transform: dragOver === p.id && dragId !== p.id ? 'scale(1.02)' : 'scale(1)',
                        transition: 'opacity 0.15s, transform 0.15s',
                        cursor: 'grab',
                      }}
                    >
                      <ProjectCard project={p}
                        onClick={() => navigate(`/project/${p.id}`)}
                        onEdit={openEdit}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Colaborações */}
            {collabs.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: C.black, letterSpacing: '0.03em' }}>COLABORAÇÕES</div>
                  <span style={{ fontSize: 11, color: C.gray500, background: C.gray100, padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>{collabs.length}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                  {collabs.map(c => {
                    const p = c.projects
                    if (!p) return null
                    return (
                      <div key={p.id} style={{ position: 'relative' }}>
                        <ProjectCard project={p} onClick={() => navigate(`/project/${p.id}`)} onEdit={() => {}} />
                        <div style={{ position: 'absolute', top: 10, right: 10, background: C.blueLight, color: C.blue, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>
                          {c.role === 'viewer' ? 'Visualizador' : c.role === 'editor' ? 'Editor' : 'Admin'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Mobile bottom nav ── */}
      <MobileNav
        items={MOBILE_NAV_ITEMS}
        activeKey={activeSection}
        onSelect={handleMobileNav}
        avatarUrl={profile?.avatar_url}
        userName={profile?.name || user?.email || ''}
        onAvatarPress={() => setActiveSection(s => s === 'perfil' ? 'obras' : 'perfil')}
      />

      {/* ── Modals ── */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); setFormError('') }} title="Nova obra" width={520}>
        <ProjectForm form={form} setForm={setForm} onSubmit={handleCreate} onCancel={() => { setShowCreate(false); setFormError('') }} error={formError} loading={creating} isEdit={false} />
      </Modal>

      <Modal open={!!editProject} onClose={() => setEditProject(null)} title={`Editar: ${editProject?.name || ''}`} width={520}>
        <ProjectForm form={editForm} setForm={setEditForm} onSubmit={handleEdit} onCancel={() => setEditProject(null)} error={editError} loading={editing} isEdit={true} />
      </Modal>
    </div>
  )
}

const formLabelStyle = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: C.gray700,
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}
