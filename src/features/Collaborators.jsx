import { useState, useEffect } from 'react'
import { C, FONT_BODY, FONT_DISPLAY } from '../tokens'
import { Btn, Input, Select, Badge, Avatar, Alert, Spinner, Empty, Icon } from '../components/ui'
import {
  fetchCollaborators,
  inviteCollaborator,
  updateCollaboratorRole,
  removeCollaborator,
  findUserByEmail,
} from '../lib/supabase'

const ROLE_OPTIONS = [
  { value: 'viewer', label: 'Visualizador', desc: 'Apenas leitura' },
  { value: 'editor', label: 'Editor',       desc: 'Pode editar atividades e materiais' },
  { value: 'admin',  label: 'Admin',        desc: 'Acesso total exceto excluir projeto' },
]

const ROLE_COLORS = {
  owner:  { bg: C.amberLight, cor: C.amber  },
  admin:  { bg: C.redLight,   cor: C.red    },
  editor: { bg: C.blueLight,  cor: C.blue   },
  viewer: { bg: C.gray100,    cor: C.gray500 },
}

function CollaboratorRow({ collab, isOwner, currentUserId, onRoleChange, onRemove }) {
  const profile = collab.profiles || {}
  const name = profile.name || profile.email || 'Usuário'
  const rc = ROLE_COLORS[collab.role] || ROLE_COLORS.viewer
  const isCurrentUser = collab.user_id === currentUserId
  const isOwnerRow = collab.role === 'owner'

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 16px',
      borderBottom: `1px solid ${C.gray100}`,
      background: C.white,
    }}>
      <Avatar name={name} url={profile.avatar_url} size={36} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          color: C.black,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          {name}
          {isCurrentUser && (
            <span style={{
              fontSize: 10, color: C.orange, background: C.orangeLight,
              padding: '1px 6px', borderRadius: 10, fontWeight: 700,
            }}>
              Você
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: C.gray500, marginTop: 1 }}>
          {profile.email || '—'}
        </div>
      </div>

      {isOwnerRow ? (
        <Badge label="Resp. Técnico" cor={ROLE_COLORS.owner.cor} bg={ROLE_COLORS.owner.bg} />
      ) : (
        <select
          value={collab.role}
          onChange={e => onRoleChange(collab.id, e.target.value)}
          disabled={!isOwner && !isCurrentUser}
          style={{
            fontFamily: FONT_BODY,
            fontSize: 12,
            padding: '5px 8px',
            border: `1.5px solid ${rc.cor}`,
            borderRadius: 6,
            background: rc.bg,
            color: rc.cor,
            cursor: isOwner ? 'pointer' : 'not-allowed',
            fontWeight: 700,
            outline: 'none',
          }}
        >
          {ROLE_OPTIONS.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      )}

      {!isOwnerRow && isOwner && (
        <button
          onClick={() => onRemove(collab)}
          title="Remover colaborador"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: C.red, display: 'flex', padding: 6, borderRadius: 4,
          }}
        >
          <Icon name="x" size={16} color={C.red} />
        </button>
      )}
    </div>
  )
}

export default function Collaborators({ projectId, ownerId, userId }) {
  const [collabs, setCollabs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [searchEmail, setSearchEmail] = useState('')
  const [searching, setSearching] = useState(false)
  const [foundUser, setFoundUser] = useState(null)
  const [searchError, setSearchError] = useState('')
  const [inviteRole, setInviteRole] = useState('viewer')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')

  const isOwner = userId === ownerId

  useEffect(() => {
    if (projectId) loadCollabs()
  }, [projectId])

  async function loadCollabs() {
    setLoading(true)
    try {
      const { data, error: err } = await fetchCollaborators(projectId)
      if (err) throw err
      setCollabs(data || [])
    } catch (err) {
      setError(err.message || 'Erro ao carregar colaboradores.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSearch(e) {
    e.preventDefault()
    if (!searchEmail.trim()) return
    setSearching(true)
    setSearchError('')
    setFoundUser(null)
    try {
      const { data, error: err } = await findUserByEmail(searchEmail.trim().toLowerCase())
      if (err || !data) {
        setSearchError('Nenhum usuário encontrado com esse e-mail.')
        return
      }
      const alreadyIn = collabs.some(c => c.user_id === data.id)
      if (alreadyIn) {
        setSearchError('Este usuário já é colaborador desta obra.')
        return
      }
      if (data.id === ownerId) {
        setSearchError('Este usuário é o responsável técnico da obra.')
        return
      }
      setFoundUser(data)
    } catch (err) {
      setSearchError(err.message || 'Erro ao buscar usuário.')
    } finally {
      setSearching(false)
    }
  }

  async function handleInvite() {
    if (!foundUser) return
    setInviting(true)
    setInviteMsg('')
    try {
      const { data, error: err } = await inviteCollaborator(projectId, foundUser.id, inviteRole)
      if (err) throw err
      setInviteMsg(`${foundUser.name || foundUser.email} adicionado como ${ROLE_OPTIONS.find(r => r.value === inviteRole)?.label}.`)
      setFoundUser(null)
      setSearchEmail('')
      setInviteRole('viewer')
      await loadCollabs()
    } catch (err) {
      setInviteMsg(err.message || 'Erro ao convidar.')
    } finally {
      setInviting(false)
    }
  }

  async function handleRoleChange(id, role) {
    try {
      const { error: err } = await updateCollaboratorRole(id, role)
      if (err) throw err
      setCollabs(prev => prev.map(c => c.id === id ? { ...c, role } : c))
    } catch (err) {
      setError(err.message || 'Erro ao atualizar função.')
    }
  }

  async function handleRemove(collab) {
    const name = collab.profiles?.name || collab.profiles?.email || 'este colaborador'
    if (!confirm(`Remover ${name} da obra?`)) return
    try {
      const { error: err } = await removeCollaborator(collab.id)
      if (err) throw err
      setCollabs(prev => prev.filter(c => c.id !== collab.id))
    } catch (err) {
      setError(err.message || 'Erro ao remover colaborador.')
    }
  }

  const ownerEntry = {
    id: 'owner',
    user_id: ownerId,
    role: 'owner',
    profiles: collabs.find(c => c.user_id === ownerId)?.profiles || { email: 'Resp. Técnico' },
  }
  const collabList = [ownerEntry, ...collabs.filter(c => c.user_id !== ownerId)]

  return (
    <div style={{ fontFamily: FONT_BODY, maxWidth: 700 }}>
      <div style={{
        fontFamily: FONT_DISPLAY,
        fontWeight: 800,
        fontSize: 20,
        color: C.black,
        letterSpacing: '0.03em',
        marginBottom: 20,
      }}>
        COLABORADORES
      </div>

      {error && (
        <div style={{ marginBottom: 16 }}>
          <Alert type="error">{error}</Alert>
        </div>
      )}

      {/* Equipe da obra */}
      <div style={{
        background: C.white,
        border: `1px solid ${C.gray200}`,
        borderRadius: 10,
        overflow: 'hidden',
        marginBottom: 24,
      }}>
        <div style={{
          padding: '10px 16px',
          background: C.gray50,
          borderBottom: `1px solid ${C.gray200}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: 13,
            color: C.black,
            letterSpacing: '0.05em',
          }}>
            EQUIPE DA OBRA
          </span>
          <span style={{ fontSize: 11, color: C.gray500 }}>{collabList.length} membro(s)</span>
        </div>

        {loading ? (
          <div style={{ padding: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <Spinner />
            <span style={{ fontSize: 13, color: C.gray500 }}>Carregando...</span>
          </div>
        ) : collabList.length === 0 ? (
          <Empty icon="users" text="Nenhum colaborador cadastrado." />
        ) : (
          collabList.map(c => (
            <CollaboratorRow
              key={c.id}
              collab={c}
              isOwner={isOwner}
              currentUserId={userId}
              onRoleChange={handleRoleChange}
              onRemove={handleRemove}
            />
          ))
        )}
      </div>

      {/* Convidar */}
      {isOwner && (
        <div style={{
          background: C.white,
          border: `1px solid ${C.gray200}`,
          borderRadius: 10,
          padding: '20px',
        }}>
          <div style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: 15,
            color: C.black,
            letterSpacing: '0.04em',
            marginBottom: 6,
          }}>
            CONVIDAR USUÁRIO
          </div>
          <div style={{ fontSize: 12, color: C.gray500, marginBottom: 16 }}>
            O usuário precisa já ter uma conta no Splanner.
          </div>

          {inviteMsg && (
            <div style={{ marginBottom: 14 }}>
              <Alert type={inviteMsg.includes('Erro') ? 'error' : 'success'}>{inviteMsg}</Alert>
            </div>
          )}

          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <Input
              type="email"
              value={searchEmail}
              onChange={e => { setSearchEmail(e.target.value); setFoundUser(null); setSearchError('') }}
              placeholder="email@exemplo.com"
              style={{ flex: 1 }}
            />
            <Btn type="submit" variant="black" icon="eye" disabled={searching}>
              {searching ? 'Buscando...' : 'Buscar'}
            </Btn>
          </form>

          {searchError && (
            <div style={{ marginBottom: 14 }}>
              <Alert type="warning">{searchError}</Alert>
            </div>
          )}

          {foundUser && (
            <div style={{
              border: `1.5px solid ${C.green}`,
              borderRadius: 8,
              padding: '12px 14px',
              background: C.greenLight,
              marginBottom: 14,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar name={foundUser.name || foundUser.email} size={36} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.black }}>
                    {foundUser.name || 'Sem nome'}
                  </div>
                  <div style={{ fontSize: 12, color: C.gray500 }}>{foundUser.email}</div>
                </div>
                <Icon name="check" size={20} color={C.green} />
              </div>
            </div>
          )}

          {foundUser && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.gray700, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Função
                </label>
                <Select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                >
                  {ROLE_OPTIONS.map(r => (
                    <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
                  ))}
                </Select>
              </div>
              <Btn
                variant="primary"
                icon="users"
                onClick={handleInvite}
                disabled={inviting}
                style={{ alignSelf: 'flex-end' }}
              >
                {inviting ? 'Adicionando...' : 'Adicionar'}
              </Btn>
            </div>
          )}

          {/* Sobre as funções */}
          <div style={{ marginTop: 20, borderTop: `1px solid ${C.gray100}`, paddingTop: 16 }}>
            <div style={{ fontSize: 11, color: C.gray500, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10 }}>
              Sobre as funções
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ROLE_OPTIONS.map(r => {
                const rc = ROLE_COLORS[r.value] || ROLE_COLORS.viewer
                return (
                  <div key={r.value} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Badge label={r.label} cor={rc.cor} bg={rc.bg} />
                    <span style={{ fontSize: 12, color: C.gray500 }}>{r.desc}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {!isOwner && (
        <div style={{ padding: '16px', background: C.gray50, borderRadius: 8, border: `1px solid ${C.gray200}` }}>
          <Alert type="info">
            Apenas o responsável técnico pode gerenciar colaboradores.
          </Alert>
        </div>
      )}
    </div>
  )
}
