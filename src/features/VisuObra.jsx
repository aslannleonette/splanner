import { useState, useEffect } from 'react'
import { C, FONT_BODY, FONT_DISPLAY } from '../tokens'
import {
  visuobra, signInVisuObra, signOutVisuObra, getVisuSession,
  fetchVisuObras, fetchVisuPhotos, getVisuPhotoUrl,
} from '../lib/visuobra'
import { updateProject } from '../lib/supabase'
import { Btn, Spinner, Alert, Icon } from '../components/ui'

// ─── Lightbox ────────────────────────────────────────────────────────────────
function Lightbox({ photos, index, onClose, onNav }) {
  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') onNav(1)
      if (e.key === 'ArrowLeft') onNav(-1)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose, onNav])

  const photo = photos[index]
  if (!photo) return null
  const url = getVisuPhotoUrl(photo.image_path)

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.93)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      {index > 0 && (
        <button onClick={(e) => { e.stopPropagation(); onNav(-1) }} style={{
          position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
          background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '50%', width: 44, height: 44,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#fff', fontSize: 22,
        }}>‹</button>
      )}
      <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh', textAlign: 'center' }}>
        <img src={url} alt={photo.titulo || ''} style={{
          maxWidth: '100%', maxHeight: '80vh', borderRadius: 10,
          objectFit: 'contain', boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
        }} />
        {(photo.titulo || photo.descricao) && (
          <div style={{ marginTop: 10, color: '#d1d5db', fontFamily: FONT_BODY, fontSize: 13 }}>
            {photo.titulo && <strong style={{ display: 'block' }}>{photo.titulo}</strong>}
            {photo.descricao && <span>{photo.descricao}</span>}
          </div>
        )}
        {photo.data_ref && (
          <div style={{ color: '#6b7280', fontSize: 11, marginTop: 4 }}>
            {new Date(photo.data_ref).toLocaleDateString('pt-BR')}
            {' · '}{index + 1}/{photos.length}
          </div>
        )}
      </div>
      {index < photos.length - 1 && (
        <button onClick={(e) => { e.stopPropagation(); onNav(1) }} style={{
          position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
          background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '50%', width: 44, height: 44,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#fff', fontSize: 22,
        }}>›</button>
      )}
      <button onClick={onClose} style={{
        position: 'absolute', top: 16, right: 16,
        background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: '50%', width: 36, height: 36,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: '#fff', fontSize: 18,
      }}>✕</button>
    </div>
  )
}

// ─── Login Form ──────────────────────────────────────────────────────────────
function LoginForm({ onLogin }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { data, error: err } = await signInVisuObra(email, password)
    setLoading(false)
    if (err) { setError(err.message || 'E-mail ou senha incorretos. Verifique suas credenciais do VisuObra.'); return }
    if (!data?.user) { setError('Sessão não iniciada. Tente novamente.'); return }
    onLogin(data.user)
  }

  return (
    <div style={{
      maxWidth: 360, margin: '0 auto', padding: '40px 24px',
      background: C.white, border: `1px solid ${C.gray200}`,
      borderRadius: 16, textAlign: 'center',
    }}>
      {/* Logo VisuObra */}
      <div style={{
        width: 56, height: 56, borderRadius: 14,
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 16px', fontSize: 28,
      }}>📸</div>

      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 18, color: C.black, marginBottom: 4 }}>
        Conectar ao VisuObra
      </div>
      <div style={{ fontSize: 13, color: C.gray500, marginBottom: 24 }}>
        Entre com sua conta <strong>visuobra.eng.br</strong>
      </div>

      {error && <Alert type="error" style={{ marginBottom: 16 }}>{error}</Alert>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          type="email" placeholder="E-mail do VisuObra" required
          value={email} onChange={(e) => setEmail(e.target.value)}
          style={{
            padding: '10px 14px', border: `1px solid ${C.gray200}`,
            borderRadius: 8, fontFamily: FONT_BODY, fontSize: 14,
            background: C.white, color: C.black,
          }}
        />
        <input
          type="password" placeholder="Senha" required
          value={password} onChange={(e) => setPassword(e.target.value)}
          style={{
            padding: '10px 14px', border: `1px solid ${C.gray200}`,
            borderRadius: 8, fontFamily: FONT_BODY, fontSize: 14,
            background: C.white, color: C.black,
          }}
        />
        <Btn type="submit" variant="primary" disabled={loading} style={{ marginTop: 4 }}>
          {loading ? 'Entrando...' : 'Entrar no VisuObra'}
        </Btn>
      </form>
    </div>
  )
}

// ─── Obra Picker ──────────────────────────────────────────────────────────────
function ObraPicker({ userId, currentObraId, onSelect, onLogout }) {
  const [obras, setObras]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchVisuObras(userId).then(({ data }) => {
      setObras(data || [])
      setLoading(false)
    })
  }, [userId])

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: C.black }}>
            Selecione a obra do VisuObra
          </div>
          <div style={{ fontSize: 12, color: C.gray500, marginTop: 2 }}>
            {obras.length} obra{obras.length !== 1 ? 's' : ''} encontrada{obras.length !== 1 ? 's' : ''}
          </div>
        </div>
        <button onClick={onLogout} style={{
          background: 'none', border: `1px solid ${C.gray200}`, borderRadius: 8,
          padding: '6px 12px', cursor: 'pointer', fontSize: 12, color: C.gray500,
          fontFamily: FONT_BODY,
        }}>Sair do VisuObra</button>
      </div>

      {obras.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 24px', color: C.gray400 }}>
          Nenhuma obra encontrada no VisuObra.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {obras.map(obra => {
            const selected = obra.id === currentObraId
            return (
              <div
                key={obra.id}
                onClick={() => onSelect(obra)}
                style={{
                  padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
                  border: `2px solid ${selected ? C.orange : C.gray200}`,
                  background: selected ? C.amberLight : C.white,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  transition: 'all 0.15s',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: C.black }}>{obra.nome}</div>
                  <div style={{ fontSize: 12, color: C.gray500, marginTop: 2 }}>
                    {[obra.cidade, obra.uf].filter(Boolean).join(' · ')}
                    {obra.cliente && ` · ${obra.cliente}`}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    color: obra.status === 'Em andamento' ? '#22c55e' : C.gray500,
                    background: obra.status === 'Em andamento' ? 'rgba(34,197,94,0.1)' : C.gray100,
                    padding: '2px 8px', borderRadius: 10,
                  }}>{obra.status || 'Em andamento'}</span>
                  {selected && <span style={{ color: C.orange, fontSize: 18 }}>✓</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Photo Gallery ────────────────────────────────────────────────────────────
function PhotoGallery({ obraId, obraName, onChangeObra }) {
  const [photos, setPhotos]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [lightboxIdx, setLightboxIdx] = useState(null)

  useEffect(() => {
    if (!obraId) return
    setLoading(true)
    fetchVisuPhotos(obraId).then(({ data }) => {
      setPhotos(data || [])
      setLoading(false)
    })
  }, [obraId])

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner /></div>

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 18, color: C.black }}>
            📸 {obraName}
          </div>
          <div style={{ fontSize: 12, color: C.gray500, marginTop: 3 }}>
            {photos.length} foto{photos.length !== 1 ? 's' : ''} via VisuObra
          </div>
        </div>
        <button onClick={onChangeObra} style={{
          background: 'none', border: `1px solid ${C.gray200}`, borderRadius: 8,
          padding: '7px 14px', cursor: 'pointer', fontSize: 12, color: C.gray500,
          fontFamily: FONT_BODY, display: 'flex', alignItems: 'center', gap: 6,
        }}>
          🔄 Trocar obra
        </button>
      </div>

      {photos.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px 24px', color: C.gray400,
          border: `1px dashed ${C.gray200}`, borderRadius: 12, fontFamily: FONT_BODY,
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📷</div>
          Nenhuma foto registrada nesta obra no VisuObra.
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 10,
        }}>
          {photos.map((photo, idx) => (
            <div
              key={photo.id}
              onClick={() => setLightboxIdx(idx)}
              style={{
                aspectRatio: '4/3', borderRadius: 8, overflow: 'hidden',
                cursor: 'pointer', background: C.gray100,
                transition: 'transform 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.03)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <img
                src={getVisuPhotoUrl(photo.image_path)}
                alt={photo.titulo || ''}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}

      {lightboxIdx !== null && (
        <Lightbox
          photos={photos}
          index={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onNav={(d) => setLightboxIdx(i => Math.max(0, Math.min(photos.length - 1, i + d)))}
        />
      )}
    </div>
  )
}

// ─── Main VisuObra Component ──────────────────────────────────────────────────
export default function VisuObra({ project, onProjectUpdate }) {
  const [visuUser, setVisuUser]     = useState(null)         // user logado no VisuObra
  const [phase, setPhase]           = useState('checking')   // checking | login | pick | gallery
  const [selectedObra, setSelectedObra] = useState(null)     // { id, nome, ... }
  const [saving, setSaving]         = useState(false)

  // Check se já há sessão VisuObra salva
  useEffect(() => {
    getVisuSession().then(({ data: { session } }) => {
      if (session?.user) {
        setVisuUser(session.user)
        setPhase(project?.visuobra_obra_id ? 'gallery' : 'pick')
      } else {
        setPhase('login')
      }
    })
  }, [])

  // Quando project.visuobra_obra_id muda, vai pro gallery se logado
  useEffect(() => {
    if (visuUser && project?.visuobra_obra_id) {
      setPhase('gallery')
    }
  }, [project?.visuobra_obra_id, visuUser])

  const handleLogin = (user) => {
    setVisuUser(user)
    setPhase(project?.visuobra_obra_id ? 'gallery' : 'pick')
  }

  const handleLogout = async () => {
    await signOutVisuObra()
    setVisuUser(null)
    setPhase('login')
  }

  const handleSelectObra = async (obra) => {
    setSaving(true)
    await updateProject(project.id, { visuobra_obra_id: obra.id })
    setSaving(false)
    setSelectedObra(obra)
    if (onProjectUpdate) onProjectUpdate({ ...project, visuobra_obra_id: obra.id })
    setPhase('gallery')
  }

  if (phase === 'checking') return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner /></div>
  )

  return (
    <div style={{ fontFamily: FONT_BODY }}>
      {/* Badge VisuObra */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <div style={{
          padding: '4px 14px', borderRadius: 20,
          background: 'linear-gradient(90deg, #1a1a2e, #16213e)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 14 }}>📸</span>
          <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, color: '#fff', letterSpacing: '0.08em' }}>
            VISUOBRA
          </span>
        </div>
        {visuUser && (
          <span style={{ fontSize: 12, color: C.gray500 }}>
            Conectado como <strong style={{ color: C.black }}>{visuUser.email}</strong>
          </span>
        )}
        {saving && <span style={{ fontSize: 12, color: C.orange }}>Salvando…</span>}
      </div>

      {phase === 'login' && <LoginForm onLogin={handleLogin} />}

      {phase === 'pick' && visuUser && (
        <ObraPicker
          userId={visuUser.id}
          currentObraId={project?.visuobra_obra_id}
          onSelect={handleSelectObra}
          onLogout={handleLogout}
        />
      )}

      {phase === 'gallery' && project?.visuobra_obra_id && (
        <PhotoGallery
          obraId={project.visuobra_obra_id}
          obraName={selectedObra?.nome || `Obra #${project.visuobra_obra_id}`}
          onChangeObra={() => setPhase('pick')}
        />
      )}
    </div>
  )
}
