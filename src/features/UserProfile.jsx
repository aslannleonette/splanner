import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { C, FONT_BODY, FONT_DISPLAY } from '../tokens'
import { Btn, Alert, Input, Spinner, Icon } from '../components/ui'
import { updateProfile, supabase, signOut } from '../lib/supabase'

/* ──────────────────────────────────────────────────────────────────────────
   UserProfile — edição de perfil do usuário
   Props:
     user    — objeto auth (id, email)
     profile — objeto profile (name, company, crea, avatar_url)
     onUpdate — fn(updatedProfile) — chamada após salvar
   ────────────────────────────────────────────────────────────────────────── */
export default function UserProfile({ user, profile, onUpdate }) {
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)
  const [name,    setName]    = useState(profile?.name    || '')
  const [company, setCompany] = useState(profile?.company || '')
  const [crea,    setCrea]    = useState(profile?.crea    || '')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '')

  const [saving,         setSaving]         = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [error,          setError]          = useState('')
  const [successMsg,     setSuccessMsg]     = useState('')

  const fileInputRef = useRef(null)

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    const maxSize = 5 * 1024 * 1024 // 5 MB
    if (file.size > maxSize) {
      setError('A foto deve ter no máximo 5 MB.')
      return
    }
    if (!file.type.startsWith('image/')) {
      setError('Selecione um arquivo de imagem.')
      return
    }

    setUploadingAvatar(true)
    setError('')
    try {
      const ext  = file.name.split('.').pop().toLowerCase() || 'jpg'
      const path = `${user.id}/avatar.${ext}`

      // upsert — remove old if exists, then upload
      await supabase.storage.from('avatars').remove([path])
      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (uploadErr) throw uploadErr

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(path)

      // Append cache-buster so the browser re-fetches the new image
      const newUrl = `${urlData.publicUrl}?t=${Date.now()}`
      setAvatarUrl(newUrl)

      // Persist immediately so the nav avatar updates
      const { data: updated, error: profErr } = await updateProfile(user.id, { avatar_url: newUrl })
      if (profErr) throw profErr
      onUpdate?.(updated)
      setSuccessMsg('Foto atualizada!')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err) {
      setError(err.message || 'Erro ao enviar foto.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) { setError('Nome é obrigatório.'); return }
    setSaving(true)
    setError('')
    setSuccessMsg('')
    try {
      const { data: updated, error: err } = await updateProfile(user.id, {
        name:       name.trim(),
        company:    company.trim(),
        crea:       crea.trim(),
        avatar_url: avatarUrl,
      })
      if (err) throw err
      onUpdate?.(updated)
      setSuccessMsg('Perfil salvo com sucesso!')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err) {
      setError(err.message || 'Erro ao salvar perfil.')
    } finally {
      setSaving(false)
    }
  }

  async function handleLogout() {
    if (!confirm('Sair da sua conta?')) return
    setLoggingOut(true)
    try {
      await signOut()
      navigate('/')
    } finally {
      setLoggingOut(false)
    }
  }

  const initials = name
    ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : (user?.email?.[0] || '?').toUpperCase()

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', fontFamily: FONT_BODY }}>

      {/* Title */}
      <div style={{
        fontFamily: FONT_DISPLAY,
        fontWeight: 800,
        fontSize: 22,
        color: C.black,
        letterSpacing: '0.03em',
        marginBottom: 28,
      }}>
        MEU PERFIL
      </div>

      {/* Avatar */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginBottom: 32,
        gap: 12,
      }}>
        <div
          onClick={() => !uploadingAvatar && fileInputRef.current?.click()}
          style={{
            width: 96,
            height: 96,
            borderRadius: '50%',
            border: `3px solid ${C.orange}`,
            background: avatarUrl ? 'transparent' : C.orange,
            overflow: 'hidden',
            cursor: uploadingAvatar ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            boxShadow: '0 4px 18px rgba(232,80,10,0.35)',
            transition: 'transform 0.15s',
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="avatar"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 800,
              fontSize: 32,
              color: '#fff',
              letterSpacing: '0.02em',
              userSelect: 'none',
            }}>
              {initials}
            </span>
          )}

          {/* Overlay on hover */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            opacity: uploadingAvatar ? 1 : 0,
            transition: 'opacity 0.15s',
          }}
            onMouseEnter={e => { if (!uploadingAvatar) e.currentTarget.style.opacity = '1' }}
            onMouseLeave={e => { if (!uploadingAvatar) e.currentTarget.style.opacity = '0' }}
          >
            {uploadingAvatar
              ? <Spinner />
              : <Icon name="edit" size={22} color="#fff" />
            }
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleAvatarChange}
        />

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: C.gray500 }}>
            Clique na foto para alterar
          </div>
          <div style={{ fontSize: 11, color: C.gray300, marginTop: 2 }}>
            PNG, JPG ou WebP · máx. 5 MB
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div style={{ marginBottom: 16 }}>
          <Alert type="error">{error}</Alert>
        </div>
      )}
      {successMsg && (
        <div style={{ marginBottom: 16 }}>
          <Alert type="success">{successMsg}</Alert>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSave} style={{
        background: C.white,
        border: `1px solid ${C.gray200}`,
        borderRadius: 12,
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}>
        {/* Email (read-only) */}
        <div>
          <label style={labelStyle}>E-mail</label>
          <div style={{
            padding: '10px 14px',
            background: C.gray50,
            border: `1px solid ${C.gray200}`,
            borderRadius: 8,
            fontSize: 14,
            color: C.gray500,
            fontFamily: FONT_BODY,
          }}>
            {user?.email || '—'}
          </div>
          <div style={{ fontSize: 11, color: C.gray300, marginTop: 4 }}>
            O e-mail não pode ser alterado
          </div>
        </div>

        {/* Name */}
        <div>
          <label style={labelStyle}>Nome completo *</label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Seu nome completo"
            required
          />
        </div>

        {/* Company */}
        <div>
          <label style={labelStyle}>Empresa / Razão social</label>
          <Input
            value={company}
            onChange={e => setCompany(e.target.value)}
            placeholder="Ex: Leonette Engenharia"
          />
        </div>

        {/* CREA */}
        <div>
          <label style={labelStyle}>CREA / CAU</label>
          <Input
            value={crea}
            onChange={e => setCrea(e.target.value)}
            placeholder="Ex: 210821783-5"
          />
        </div>

        {/* Save button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
          <Btn
            type="submit"
            variant="primary"
            icon={saving ? undefined : 'check'}
            disabled={saving}
          >
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </Btn>
        </div>
      </form>

      {/* Extra info card */}
      <div style={{
        marginTop: 20,
        background: C.gray50,
        border: `1px solid ${C.gray200}`,
        borderRadius: 10,
        padding: '16px 20px',
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.gray500, letterSpacing: '0.05em', marginBottom: 8, textTransform: 'uppercase' }}>
          Dados de conta
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <InfoRow label="ID do usuário" value={user?.id ? `${user.id.slice(0, 8)}…` : '—'} />
          <InfoRow label="Cadastrado em" value={
            user?.created_at
              ? new Date(user.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
              : '—'
          } />
        </div>
      </div>

      {/* Sair da conta — sempre visível, inclusive no mobile */}
      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center' }}>
        <Btn
          variant="danger"
          icon="logout"
          onClick={handleLogout}
          disabled={loggingOut}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {loggingOut ? 'Saindo...' : 'Sair da conta'}
        </Btn>
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
      <span style={{ color: C.gray500 }}>{label}</span>
      <span style={{ color: C.black, fontWeight: 600 }}>{value}</span>
    </div>
  )
}

const labelStyle = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: C.gray700,
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}
