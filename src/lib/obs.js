// Observações de uma etapa — lista de itens numerados (Obs 01, Obs 02, ...),
// guardados no mesmo campo de texto `observacoes` (coluna já existente),
// como um JSON array. Mantém compatibilidade com etapas antigas que tinham
// um texto simples salvo nesse campo (viram um item único da lista).

export function parseObsList(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.filter(s => typeof s === 'string' && s.trim())
  const text = String(raw).trim()
  if (!text) return []
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) return parsed.filter(s => typeof s === 'string' && s.trim())
    } catch {
      // não era JSON válido — trata como texto simples abaixo
    }
  }
  return [text]
}

export function stringifyObsList(list) {
  const clean = (list || []).map(s => (s || '').trim()).filter(Boolean)
  if (!clean.length) return null
  return JSON.stringify(clean)
}

export function obsListToText(list) {
  const clean = (list || []).map(s => (s || '').trim()).filter(Boolean)
  if (!clean.length) return ''
  return clean.map((o, i) => `Obs ${String(i + 1).padStart(2, '0')}: ${o}`).join('\n')
}
