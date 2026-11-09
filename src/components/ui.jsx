import { useState, useEffect, useRef } from 'react'
import { C, FONT_DISPLAY, FONT_BODY } from '../tokens'
import { useTheme } from '../hooks/useTheme'

// ─── ICON ──────────────────────────────────────────────────────────────────
const PATHS = {
  grid: 'M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z',
  pencil: 'M16.862 3.487a2.25 2.25 0 013.182 3.182L7.5 19.213l-4.5 1.125 1.125-4.5L16.862 3.487z',
  box: 'M21 8.25H3M21 8.25L12 3 3 8.25M21 8.25v10.5a.75.75 0 01-.75.75H3.75a.75.75 0 01-.75-.75V8.25M9 12h6',
  chat: 'M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.875 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.875 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z',
  link: 'M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244',
  plus: 'M12 4.5v15m7.5-7.5h-15',
  minus: 'M19.5 12h-15',
  x: 'M6 18L18 6M6 6l12 12',
  check: 'M4.5 12.75l6 6 9-13.5',
  warning: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
  clock: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
  send: 'M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5',
  arrow: 'M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75',
  copy: 'M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75',
  eye: 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  trash: 'M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0',
  construction: 'M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z',
  calendar: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z',
  chart: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
  package: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z',
  refresh: 'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99',
  home: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25',
  back: 'M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18',
  users: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  download: 'M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3',
  upload: 'M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5',
  settings: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  logout: 'M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75',
  bell: 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0',
  shield: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
  edit: 'M16.862 3.487a2.25 2.25 0 013.182 3.182l-1.159 1.16-3.182-3.182 1.16-1.16zm-2.22 2.22L4.5 15.849V19.5h3.651L18.283 9.368l-3.64-3.661z',
  file: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  sun: 'M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0z',
  grip: 'M9 3h.008v.008H9zm0 4.5h.008v.008H9zm0 4.5h.008v.008H9zm0 4.5h.008v.008H9zm4.5-13.5h.008v.008H13.5zm0 4.5h.008v.008H13.5zm0 4.5h.008v.008H13.5zm0 4.5h.008v.008H13.5z',
  moon: 'M21.752 15.002A9.72 9.72 0 0 1 18 15.75 9.75 9.75 0 0 1 8.25 6c0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 12c0 5.385 4.365 9.75 9.75 9.75 4.331 0 8.033-2.828 9.002-6.998z',
  flow: 'M4.5 3.75h5.25v4.5H4.5zM14.25 3.75h5.25v4.5h-5.25zM9.375 15.75h5.25v4.5h-5.25zM7.125 8.25v3a1.5 1.5 0 001.5 1.5h.9 M16.875 8.25v3a1.5 1.5 0 01-1.5 1.5h-.9 M12 12.75v3',
  expand: 'M3.75 9V5.25a1.5 1.5 0 011.5-1.5H9m6 0h3.75a1.5 1.5 0 011.5 1.5V9m0 6v3.75a1.5 1.5 0 01-1.5 1.5H15m-6 0H5.25a1.5 1.5 0 01-1.5-1.5V15',
}

export function Icon({ name, size = 16, color, style = {} }) {
  const d = PATHS[name]
  if (!d) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color || 'currentColor'}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }}
    >
      {d.split(' M').filter(Boolean).map((seg, i) => (
        <path key={i} d={(i === 0 ? '' : 'M') + seg} />
      ))}
    </svg>
  )
}

// ─── CARD ──────────────────────────────────────────────────────────────────
export function Card({ children, style = {} }) {
  return (
    <div style={{
      background: C.white,
      border: `1px solid ${C.gray200}`,
      borderRadius: 10,
      padding: '20px 24px',
      fontFamily: FONT_BODY,
      ...style,
    }}>
      {children}
    </div>
  )
}

// ─── SECTION TITLE ─────────────────────────────────────────────────────────
export function SectionTitle({ children }) {
  return (
    <div style={{
      fontFamily: FONT_DISPLAY,
      fontSize: 13,
      fontWeight: 600,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: C.gray500,
      marginBottom: 8,
    }}>
      {children}
    </div>
  )
}

// ─── LABEL ─────────────────────────────────────────────────────────────────
export function Label({ children }) {
  return (
    <div style={{
      fontFamily: FONT_BODY,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: C.gray500,
      marginBottom: 4,
    }}>
      {children}
    </div>
  )
}

// ─── INPUT ─────────────────────────────────────────────────────────────────
export function Input({ style = {}, ...props }) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      {...props}
      onFocus={e => { setFocused(true); props.onFocus?.(e) }}
      onBlur={e => { setFocused(false); props.onBlur?.(e) }}
      style={{
        fontFamily: FONT_BODY,
        fontSize: 14,
        padding: '8px 12px',
        border: `1.5px solid ${focused ? C.orange : C.gray200}`,
        borderRadius: 6,
        outline: 'none',
        background: C.white,
        color: C.black,
        width: '100%',
        boxSizing: 'border-box',
        transition: 'border-color 0.15s',
        ...style,
      }}
    />
  )
}

// ─── SELECT ────────────────────────────────────────────────────────────────
export function Select({ children, style = {}, ...props }) {
  const [focused, setFocused] = useState(false)
  return (
    <select
      {...props}
      onFocus={e => { setFocused(true); props.onFocus?.(e) }}
      onBlur={e => { setFocused(false); props.onBlur?.(e) }}
      style={{
        fontFamily: FONT_BODY,
        fontSize: 14,
        padding: '8px 12px',
        border: `1.5px solid ${focused ? C.orange : C.gray200}`,
        borderRadius: 6,
        outline: 'none',
        background: C.white,
        color: C.black,
        width: '100%',
        boxSizing: 'border-box',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
        ...style,
      }}
    >
      {children}
    </select>
  )
}

// ─── TEXTAREA ──────────────────────────────────────────────────────────────
export function Textarea({ style = {}, ...props }) {
  const [focused, setFocused] = useState(false)
  return (
    <textarea
      {...props}
      onFocus={e => { setFocused(true); props.onFocus?.(e) }}
      onBlur={e => { setFocused(false); props.onBlur?.(e) }}
      style={{
        fontFamily: FONT_BODY,
        fontSize: 14,
        padding: '8px 12px',
        border: `1.5px solid ${focused ? C.orange : C.gray200}`,
        borderRadius: 6,
        outline: 'none',
        background: C.white,
        color: C.black,
        width: '100%',
        boxSizing: 'border-box',
        resize: 'vertical',
        transition: 'border-color 0.15s',
        ...style,
      }}
    />
  )
}

// ─── BTN ───────────────────────────────────────────────────────────────────
const BTN_VARIANTS = {
  primary:   { bg: C.orange,   color: C.white,  border: C.orange,   hoverBg: '#C9430A' },
  black:     { bg: C.surface,  color: '#EBEBEB', border: C.surface,  hoverBg: C.gray900 },
  secondary: { bg: C.white,    color: C.black,  border: C.gray200,  hoverBg: C.gray50  },
  ghost:     { bg: 'transparent', color: C.gray700, border: 'transparent', hoverBg: C.gray100 },
  danger:    { bg: C.red,      color: C.white,  border: C.red,      hoverBg: '#B91C1C' },
  success:   { bg: C.green,    color: C.white,  border: C.green,    hoverBg: '#15803D' },
}
const BTN_SIZES = {
  sm: { padding: '5px 10px', fontSize: 12, gap: 4 },
  md: { padding: '8px 16px', fontSize: 14, gap: 6 },
  lg: { padding: '11px 22px', fontSize: 15, gap: 8 },
}

export function Btn({ children, variant = 'primary', icon, size = 'md', style = {}, ...props }) {
  const [hovered, setHovered] = useState(false)
  const v = BTN_VARIANTS[variant] || BTN_VARIANTS.primary
  const s = BTN_SIZES[size] || BTN_SIZES.md
  return (
    <button
      {...props}
      onMouseEnter={e => { setHovered(true); props.onMouseEnter?.(e) }}
      onMouseLeave={e => { setHovered(false); props.onMouseLeave?.(e) }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: s.gap,
        fontFamily: FONT_BODY,
        fontWeight: 600,
        fontSize: s.fontSize,
        padding: s.padding,
        background: hovered ? v.hoverBg : v.bg,
        color: v.color,
        border: `1.5px solid ${v.border}`,
        borderRadius: 7,
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        opacity: props.disabled ? 0.5 : 1,
        transition: 'background 0.15s',
        whiteSpace: 'nowrap',
        outline: 'none',
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={s.fontSize + 2} color={v.color} />}
      {children}
    </button>
  )
}

// ─── BADGE ─────────────────────────────────────────────────────────────────
export function Badge({ label, cor, bg }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 700,
      fontFamily: FONT_BODY,
      letterSpacing: '0.04em',
      background: bg || C.gray100,
      color: cor || C.gray700,
    }}>
      {label}
    </span>
  )
}

// ─── KPI ───────────────────────────────────────────────────────────────────
export function KPI({ label, val, sub, accent = false }) {
  return (
    <div style={{
      background: accent ? C.orange : C.white,
      border: `1px solid ${accent ? C.orange : C.gray200}`,
      borderRadius: 10,
      padding: '14px 18px',
      fontFamily: FONT_BODY,
      minWidth: 100,
    }}>
      <div style={{
        fontFamily: FONT_DISPLAY,
        fontSize: 28,
        fontWeight: 700,
        color: accent ? C.white : C.black,
        lineHeight: 1,
      }}>
        {val}
      </div>
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: accent ? 'rgba(255,255,255,0.8)' : C.gray500,
        marginTop: 4,
      }}>
        {label}
      </div>
      {sub && (
        <div style={{
          fontSize: 11,
          color: accent ? 'rgba(255,255,255,0.7)' : C.gray400,
          marginTop: 2,
        }}>
          {sub}
        </div>
      )}
    </div>
  )
}

// ─── PROGRESS BAR ──────────────────────────────────────────────────────────
export function ProgressBar({ pct = 0, color, height = 6, style = {} }) {
  const safeP = Math.min(100, Math.max(0, pct))
  return (
    <div style={{
      background: C.gray100,
      borderRadius: height,
      height,
      overflow: 'hidden',
      ...style,
    }}>
      <div style={{
        width: `${safeP}%`,
        height: '100%',
        background: color || C.orange,
        borderRadius: height,
        transition: 'width 0.5s ease',
      }} />
    </div>
  )
}

// ─── MODAL ─────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, width = 480 }) {
  useEffect(() => {
    if (!open) return
    const fn = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.white,
          borderRadius: 12,
          width: '100%',
          maxWidth: width,
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          fontFamily: FONT_BODY,
        }}
      >
        {title && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: `1px solid ${C.gray200}`,
          }}>
            <div style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: 17,
              letterSpacing: '0.02em',
              color: C.black,
            }}>
              {title}
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none',
                cursor: 'pointer', padding: 4,
                color: C.gray500, borderRadius: 4,
                display: 'flex', alignItems: 'center',
              }}
            >
              <Icon name="x" size={18} />
            </button>
          </div>
        )}
        <div style={{ padding: '20px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ─── SP LOGO ───────────────────────────────────────────────────────────────
export function SpLogo({ size = 28, mono = false }) {
  const bg = mono ? C.gray500 : '#E8500A'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {/* Ícone — 3 barras brancas escalonadas sobre fundo laranja */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block', flexShrink: 0, borderRadius: 6 }}
      >
        <rect width="100" height="100" fill={bg} />
        <rect x="45" y="14" width="55" height="21" fill="#fff" />
        <rect x="10" y="40" width="65" height="21" fill="#fff" />
        <rect x="0"  y="66" width="50" height="21" fill="#fff" />
      </svg>
      {/* Texto — sempre claro, logo vive sobre superfícies escuras */}
      <span style={{
        fontFamily: FONT_DISPLAY,
        fontWeight: 800,
        fontSize: size * 0.75,
        letterSpacing: '0.08em',
        color: '#EBEBEB',
        userSelect: 'none',
      }}>
        SPLANNER
      </span>
    </div>
  )
}

// ─── ALERT ─────────────────────────────────────────────────────────────────
const ALERT_CFG = {
  info:    { bg: C.blueLight,  color: C.blue,  icon: 'bell' },
  warning: { bg: C.amberLight, color: C.amber, icon: 'warning' },
  error:   { bg: C.redLight,   color: C.red,   icon: 'warning' },
  success: { bg: C.greenLight, color: C.green, icon: 'check' },
}

export function Alert({ type = 'info', children }) {
  const cfg = ALERT_CFG[type] || ALERT_CFG.info
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      padding: '10px 14px',
      background: cfg.bg,
      borderRadius: 8,
      color: cfg.color,
      fontFamily: FONT_BODY,
      fontSize: 13,
      fontWeight: 500,
    }}>
      <Icon name={cfg.icon} size={16} color={cfg.color} style={{ marginTop: 1, flexShrink: 0 }} />
      <div>{children}</div>
    </div>
  )
}

// ─── SPINNER ───────────────────────────────────────────────────────────────
export function Spinner() {
  return (
    <div style={{
      width: 24, height: 24,
      border: `3px solid ${C.gray200}`,
      borderTop: `3px solid ${C.orange}`,
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
    }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ─── EMPTY ─────────────────────────────────────────────────────────────────
export function Empty({ icon = 'construction', text = 'Nenhum item encontrado' }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      color: C.gray300,
      fontFamily: FONT_BODY,
      gap: 12,
    }}>
      <Icon name={icon} size={48} color={C.gray200} />
      <div style={{ fontSize: 14, color: C.gray500 }}>{text}</div>
    </div>
  )
}

// ─── AVATAR ────────────────────────────────────────────────────────────────
export function Avatar({ name = '', url, size = 32 }) {
  const initials = name
    ? name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'
  const colors = ['#E8500A', '#2563EB', '#16A34A', '#D97706', '#7C3AED']
  const ci = name.charCodeAt(0) % colors.length
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }}
      />
    )
  }
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: colors[ci] || C.orange,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: FONT_BODY,
      fontWeight: 700,
      fontSize: size * 0.38,
      color: C.white,
      flexShrink: 0,
      userSelect: 'none',
    }}>
      {initials}
    </div>
  )
}

// ─── THEME TOGGLE ───────────────────────────────────────────────────────────
export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      title={theme === 'light' ? 'Modo escuro' : 'Modo claro'}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 6,
        borderRadius: 6,
        opacity: 0.85,
      }}
    >
      <Icon name={theme === 'light' ? 'moon' : 'sun'} size={18} color={C.gray300} />
    </button>
  )
}
