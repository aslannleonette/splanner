import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signIn, signUp } from '../lib/supabase'
import { C, FONT_BODY, FONT_DISPLAY } from '../tokens'
import { SpLogo, Input, Btn, Alert } from '../components/ui'

export default function Auth() {
  const [tab, setTab] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [signedUp, setSignedUp] = useState(false)
  const navigate = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()
    if (!email || !password) { setError('Preencha e-mail e senha.'); return }
    setError('')
    setLoading(true)
    try {
      const { error: err } = await signIn(email, password)
      if (err) throw err
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Erro ao entrar. Verifique suas credenciais.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignup(e) {
    e.preventDefault()
    if (!email || !password || !name) { setError('Preencha todos os campos.'); return }
    if (password.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return }
    setError('')
    setLoading(true)
    try {
      const { error: err } = await signUp(email, password, { data: { name } })
      if (err) throw err
      setSignedUp(true)
    } catch (err) {
      setError(err.message || 'Erro ao criar conta.')
    } finally {
      setLoading(false)
    }
  }

  if (signedUp) {
    return (
      <div style={{
        minHeight: '100vh',
        background: C.black,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONT_BODY,
        padding: 24,
      }}>
        <SpLogo size={36} />
        <div style={{
          marginTop: 40,
          background: C.white,
          borderRadius: 14,
          padding: '36px 40px',
          width: '100%',
          maxWidth: 420,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>✉️</div>
          <div style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: 22,
            color: C.black,
            marginBottom: 10,
          }}>
            Confirme seu e-mail
          </div>
          <div style={{ color: C.gray700, fontSize: 14, lineHeight: 1.6 }}>
            Enviamos um link de confirmação para <strong>{email}</strong>.
            <br />
            Acesse seu e-mail e clique no link para ativar sua conta.
          </div>
          <Btn
            variant="secondary"
            style={{ marginTop: 24, width: '100%', justifyContent: 'center' }}
            onClick={() => { setSignedUp(false); setTab('login') }}
          >
            Voltar para o login
          </Btn>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: C.black,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: FONT_BODY,
      padding: 24,
    }}>
      {/* Logo */}
      <SpLogo size={36} />

      <div style={{ marginTop: 12, color: C.gray500, fontSize: 13 }}>
        Gestão inteligente de obras
      </div>

      {/* Card */}
      <div style={{
        marginTop: 36,
        background: C.white,
        borderRadius: 14,
        width: '100%',
        maxWidth: 420,
        overflow: 'hidden',
        boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
      }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.gray200}` }}>
          {[
            { key: 'login',  label: 'Entrar' },
            { key: 'signup', label: 'Criar conta' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setError('') }}
              style={{
                flex: 1,
                padding: '14px 0',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontFamily: FONT_BODY,
                fontWeight: 700,
                fontSize: 14,
                color: tab === t.key ? C.orange : C.gray500,
                borderBottom: `2px solid ${tab === t.key ? C.orange : 'transparent'}`,
                transition: 'color 0.15s, border-color 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Form */}
        <div style={{ padding: '28px 32px' }}>
          {error && (
            <div style={{ marginBottom: 16 }}>
              <Alert type="error">{error}</Alert>
            </div>
          )}

          {tab === 'login' ? (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.gray700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  E-mail
                </label>
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.gray700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Senha
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              <Btn
                type="submit"
                variant="primary"
                style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
                disabled={loading}
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </Btn>
            </form>
          ) : (
            <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.gray700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Nome completo
                </label>
                <Input
                  type="text"
                  placeholder="Seu nome"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.gray700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  E-mail
                </label>
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.gray700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Senha
                </label>
                <Input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
              <Btn
                type="submit"
                variant="primary"
                style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
                disabled={loading}
              >
                {loading ? 'Criando conta...' : 'Criar conta'}
              </Btn>
            </form>
          )}

          <div style={{
            marginTop: 20,
            textAlign: 'center',
            fontSize: 12,
            color: C.gray500,
          }}>
            {tab === 'login' ? (
              <>Não tem conta?{' '}
                <button
                  onClick={() => { setTab('signup'); setError('') }}
                  style={{ color: C.orange, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}
                >
                  Crie aqui
                </button>
              </>
            ) : (
              <>Já tem conta?{' '}
                <button
                  onClick={() => { setTab('login'); setError('') }}
                  style={{ color: C.orange, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}
                >
                  Entrar
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 24, color: C.gray700, fontSize: 11 }}>
        © {new Date().getFullYear()} Splanner · Leonette Engenharia
      </div>
    </div>
  )
}
