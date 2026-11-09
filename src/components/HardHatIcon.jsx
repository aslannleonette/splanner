/** TeamIcon — grupo de 3 pessoas, usado onde antes era o ⛑️ */
export default function HardHatIcon({ size = 20, color = '#F97316' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {/* Pessoa esquerda — cabeça */}
      <circle cx="5" cy="8" r="2.8" />
      {/* Pessoa esquerda — corpo */}
      <path d="M1 20.5C1 18.01 2.79 16 5 16s4 2.01 4 4.5H1z" />

      {/* Pessoa direita — cabeça */}
      <circle cx="19" cy="8" r="2.8" />
      {/* Pessoa direita — corpo */}
      <path d="M15 20.5C15 18.01 16.79 16 19 16s4 2.01 4 4.5H15z" />

      {/* Pessoa central (na frente, maior) — cabeça */}
      <circle cx="12" cy="6.5" r="3.5" />
      {/* Pessoa central — corpo (cobre parcialmente os laterais) */}
      <path d="M5.5 22C5.5 18.41 8.41 15.5 12 15.5S18.5 18.41 18.5 22H5.5z" />
    </svg>
  )
}
