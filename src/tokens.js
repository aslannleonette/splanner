export const C = {
  orange:      'var(--c-orange)',
  orangeLight: 'var(--c-orangeLight)',
  black:       'var(--c-black)',
  gray900:     'var(--c-gray900)',
  gray700:     'var(--c-gray700)',
  gray500:     'var(--c-gray500)',
  gray400:     'var(--c-gray400)',
  gray300:     'var(--c-gray300)',
  gray200:     'var(--c-gray200)',
  gray100:     'var(--c-gray100)',
  gray50:      'var(--c-gray50)',
  white:       'var(--c-white)',
  green:       'var(--c-green)',
  greenLight:  'var(--c-greenLight)',
  red:         'var(--c-red)',
  redLight:    'var(--c-redLight)',
  amber:       'var(--c-amber)',
  amberLight:  'var(--c-amberLight)',
  blue:        'var(--c-blue)',
  blueLight:   'var(--c-blueLight)',
  surface:     'var(--c-surface)',
  // Cores fixas para texto SOBRE fundos escuros (C.surface) — não mudam com o tema
  onSurface:      '#EBEBEB',
  onSurfaceMuted: 'rgba(235,235,235,0.55)',
}

export const FONT_DISPLAY = "'Barlow Condensed', 'Oswald', sans-serif"
export const FONT_BODY    = "'DM Sans', 'Helvetica Neue', sans-serif"

export const TIPO_CFG = {
  exec:    { cor: C.black,   label: 'Execução'       },
  concr:   { cor: C.orange,  label: 'Concretagem'    },
  usinado: { cor: C.amber,   label: 'Usinado'        },
  cura:    { cor: '#3b82f6', label: 'Cura'           },
  magro:   { cor: C.gray500, label: 'Concreto magro' },
}

export const STATUS_MAT = {
  pendente: { bg: C.gray100,     cor: C.gray700, label: 'Pendente', icon: 'clock'   },
  pedido:   { bg: C.amberLight,  cor: C.amber,   label: 'Pedido',   icon: 'send'    },
  parcial:  { bg: C.orangeLight, cor: C.orange,  label: 'Parcial',  icon: 'package' },
  chegou:   { bg: C.greenLight,  cor: C.green,   label: 'Chegou',   icon: 'check'   },
  urgente:  { bg: C.redLight,    cor: C.red,     label: 'Urgente',  icon: 'warning' },
}

export const GRUPOS_PADRAO = [
  'SERVIÇOS PRELIMINARES',
  'FUNDAÇÃO — SAPATAS',
  'FUNDAÇÃO — ARRANQUES E VIGAS BALDRAME',
  'ESTRUTURA TÉRREO — PILARES',
  'ESTRUTURA TÉRREO — VIGAS E LAJE',
  'ESTRUTURA SUPERIOR — PILARES',
  'ESTRUTURA SUPERIOR — VIGAS E LAJE',
  'COBERTURA',
]

export const UNIDADES = ['un','kg','sc','m³','m²','m','l','vb','cx','rolo','folha','barra','saco']
