import { C, FONT_BODY, FONT_DISPLAY } from '../tokens'
import { Icon } from './ui'
import useIsMobile from '../hooks/useIsMobile'

/* ──────────────────────────────────────────────────────────────────────────
   MobileNav — barra de navegação inferior com avatar elevado no centro
   Props:
     items      — array de { key, icon, label }  (máx 4 — 2 esq + 2 dir)
     activeKey  — key ativo
     onSelect   — fn(key)
     avatarUrl  — URL da foto (opcional)
     userName   — string para gerar iniciais
     onAvatarPress — fn() — ao clicar no avatar (ex: abrir perfil)
   ────────────────────────────────────────────────────────────────────────── */
export default function MobileNav({ items = [], activeKey, onSelect, avatarUrl, userName = '', onAvatarPress }) {
  const isMobile = useIsMobile()
  if (!isMobile) return null

  const left  = items.slice(0, 2)
  const right  = items.slice(2, 4)

  const initials = userName
    ? userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  const NAV_H    = 62   // bar height
  const AVT_SIZE = 58   // avatar diameter
  const AVT_LIFT = 20   // how much avatar floats above bar

  return (
    <>
      {/* Spacer so content doesn't sit behind bar */}
      <div style={{ height: NAV_H + AVT_LIFT }} />

      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: NAV_H,
        background: C.surface,
        borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 200,
        paddingBottom: 'env(safe-area-inset-bottom)',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.35)',
      }}>
        {/* Left items */}
        {left.map(item => (
          <NavItem
            key={item.key}
            icon={item.icon}
            label={item.label}
            active={activeKey === item.key}
            onPress={() => onSelect(item.key)}
          />
        ))}

        {/* Center avatar space */}
        <div style={{ width: AVT_SIZE + 16, flexShrink: 0 }} />

        {/* Right items */}
        {right.map(item => (
          <NavItem
            key={item.key}
            icon={item.icon}
            label={item.label}
            active={activeKey === item.key}
            onPress={() => onSelect(item.key)}
          />
        ))}

        {/* Floating avatar (centered, elevated) */}
        <button
          onClick={onAvatarPress}
          style={{
            position: 'absolute',
            left: '50%',
            bottom: NAV_H - AVT_SIZE / 2 - AVT_LIFT / 2,
            transform: 'translateX(-50%)',
            width: AVT_SIZE,
            height: AVT_SIZE,
            borderRadius: '50%',
            border: `3px solid ${C.orange}`,
            background: avatarUrl ? 'transparent' : C.orange,
            overflow: 'hidden',
            cursor: 'pointer',
            padding: 0,
            outline: 'none',
            boxShadow: '0 4px 18px rgba(232,80,10,0.45)',
            zIndex: 10,
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
          onTouchStart={e => e.currentTarget.style.transform = 'translateX(-50%) scale(0.94)'}
          onTouchEnd={e => e.currentTarget.style.transform = 'translateX(-50%) scale(1)'}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 800,
              fontSize: 20,
              color: '#fff',
              letterSpacing: '0.02em',
              userSelect: 'none',
            }}>
              {initials}
            </span>
          )}
        </button>
      </nav>
    </>
  )
}

function NavItem({ icon, label, active, onPress }) {
  return (
    <button
      onClick={onPress}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        height: '100%',
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        padding: '6px 4px 0',
        outline: 'none',
        transition: 'opacity 0.15s',
      }}
    >
      <div style={{
        width: 36, height: 28,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 10,
        background: active ? C.orangeLight : 'transparent',
        transition: 'background 0.15s',
      }}>
        <Icon name={icon} size={18} color={active ? C.orange : 'rgba(235,235,235,0.45)'} />
      </div>
      <span style={{
        fontSize: 10,
        fontWeight: active ? 700 : 500,
        color: active ? C.orange : 'rgba(235,235,235,0.45)',
        fontFamily: FONT_BODY,
        lineHeight: 1,
      }}>
        {label}
      </span>
    </button>
  )
}
