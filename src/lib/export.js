import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

const ORANGE = [232, 80, 10]
const BLACK  = [13, 13, 13]
const GRAY   = [115, 115, 115]
const WHITE  = [255, 255, 255]

// ─── HELPERS ──────────────────────────────────────────────────────────────
function pctColor(pct) {
  if (pct === 100) return [22, 163, 74]
  if (pct > 0)    return [232, 80, 10]
  return [196, 196, 196]
}

// ─── PDF RELATÓRIO DE OBRA ─────────────────────────────────────────────────
export function exportPDF(project, activities, materials, rdos, baselines) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const pct = activities.length
    ? Math.round(activities.reduce((a, b) => a + (b.pct || 0), 0) / activities.length)
    : 0

  // Header
  doc.setFillColor(...BLACK)
  doc.rect(0, 0, W, 22, 'F')
  doc.setFillColor(...ORANGE)
  doc.rect(0, 22, W, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...WHITE)
  doc.text('SPLANNER', 12, 14)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(project.name, 55, 10)
  doc.setTextColor(...GRAY)
  doc.setFontSize(8)
  doc.text(`${project.responsible || ''} · Semana ${project.current_week}/${project.weeks} · Avanço ${pct}%`, 55, 16)
  doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, W - 12, 16, { align: 'right' })

  let y = 32

  // KPIs
  const kpis = [
    ['Avanço Geral', `${pct}%`],
    ['Semana', `${project.current_week} / ${project.weeks}`],
    ['Atividades', `${activities.filter(a => a.pct === 100).length} / ${activities.length}`],
    ['Atrasadas', activities.filter(a => a.status === 'atrasado').length],
    ['Materiais', `${materials.filter(m => m.status === 'chegou').length} / ${materials.length}`],
    ['RDOs', rdos.length],
  ]
  const kpiW = (W - 24) / kpis.length
  kpis.forEach(([label, val], i) => {
    const x = 12 + i * kpiW
    doc.setFillColor(242, 242, 242)
    doc.roundedRect(x, y, kpiW - 2, 16, 1, 1, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(...BLACK)
    doc.text(String(val), x + kpiW / 2 - 1, y + 9, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...GRAY)
    doc.text(label.toUpperCase(), x + kpiW / 2 - 1, y + 14, { align: 'center' })
  })
  y += 24

  // Atividades table
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...BLACK)
  doc.text('CRONOGRAMA DE ATIVIDADES', 12, y)
  y += 4

  const actRows = activities.map(a => [
    a.name,
    a.group_name,
    `S${a.week_start} – S${a.week_end}`,
    `${a.pct}%`,
    a.status,
  ])

  autoTable(doc, {
    startY: y,
    head: [['Atividade', 'Etapa', 'Semanas', 'Avanço', 'Status']],
    body: actRows,
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: BLACK, textColor: WHITE, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 249, 249] },
    columnStyles: {
      0: { cellWidth: 80 },
      3: { halign: 'center' },
      4: { halign: 'center' },
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 2) {
        // mini Gantt bar
      }
    },
  })

  // Materiais table (new page if needed)
  if (materials.length > 0) {
    doc.addPage()
    doc.setFillColor(...BLACK)
    doc.rect(0, 0, W, 12, 'F')
    doc.setFillColor(...ORANGE)
    doc.rect(0, 12, W, 1.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...WHITE)
    doc.text('REQUISIÇÃO DE MATERIAIS', 12, 8)

    const matRows = materials.map(m => [
      m.name,
      m.group_name || '',
      `${m.quantity} ${m.unit}`,
      `S${m.week}`,
      m.status,
      m.received_qty ? `${m.received_qty} ${m.unit}` : '—',
      m.notes || '',
    ])

    autoTable(doc, {
      startY: 18,
      head: [['Material', 'Etapa', 'Qtd', 'Semana', 'Status', 'Recebido', 'Obs.']],
      body: matRows,
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: BLACK, textColor: WHITE, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 249, 249] },
    })
  }

  // RDOs
  if (rdos.length > 0) {
    doc.addPage()
    doc.setFillColor(...BLACK)
    doc.rect(0, 0, W, 12, 'F')
    doc.setFillColor(...ORANGE)
    doc.rect(0, 12, W, 1.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...WHITE)
    doc.text('RELATÓRIOS DIÁRIOS DE OBRA (RDO)', 12, 8)

    const rdoRows = rdos.map(r => [
      `S${r.week}`,
      new Date(r.date || r.created_at).toLocaleDateString('pt-BR'),
      r.profiles?.name || r.profiles?.email || '—',
      r.content,
    ])

    autoTable(doc, {
      startY: 18,
      head: [['Semana', 'Data', 'Autor', 'Relato']],
      body: rdoRows,
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: BLACK, textColor: WHITE, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 249, 249] },
      columnStyles: { 3: { cellWidth: 160 } },
    })
  }

  return doc
}

// ─── EXCEL PLANILHA DE CONTROLE ────────────────────────────────────────────
export function exportExcel(project, activities, materials, rdos) {
  const wb = XLSX.utils.book_new()
  const pct = activities.length
    ? Math.round(activities.reduce((a, b) => a + (b.pct || 0), 0) / activities.length)
    : 0

  // Sheet 1: Atividades
  const actData = [
    [`SPLANNER — ${project.name}`],
    [`Responsável: ${project.responsible || ''}  |  Semana ${project.current_week}/${project.weeks}  |  Avanço: ${pct}%`],
    [],
    ['Item', 'Atividade', 'Etapa', 'Sem. Início', 'Sem. Fim', 'Avanço (%)', 'Status'],
    ...activities.map((a, i) => [
      i + 1, a.name, a.group_name, a.week_start, a.week_end, a.pct, a.status
    ]),
  ]
  const wsAct = XLSX.utils.aoa_to_sheet(actData)
  wsAct['!cols'] = [{ wch: 5 }, { wch: 40 }, { wch: 30 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, wsAct, 'Cronograma')

  // Sheet 2: Materiais
  const matData = [
    ['Material', 'Etapa', 'Quantidade', 'Unidade', 'Semana', 'Status', 'Recebido', 'Observação'],
    ...materials.map(m => [
      m.name, m.group_name, m.quantity, m.unit, m.week, m.status, m.received_qty || 0, m.notes || ''
    ]),
  ]
  const wsMat = XLSX.utils.aoa_to_sheet(matData)
  wsMat['!cols'] = [{ wch: 35 }, { wch: 30 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 30 }]
  XLSX.utils.book_append_sheet(wb, wsMat, 'Materiais')

  // Sheet 3: RDOs
  if (rdos.length) {
    const rdoData = [
      ['Semana', 'Data', 'Autor', 'Relato', 'Tempo', 'Trabalhadores'],
      ...rdos.map(r => [
        r.week,
        new Date(r.date || r.created_at).toLocaleDateString('pt-BR'),
        r.profiles?.name || r.profiles?.email || '',
        r.content,
        r.weather || '',
        r.workers || '',
      ]),
    ]
    const wsRdo = XLSX.utils.aoa_to_sheet(rdoData)
    wsRdo['!cols'] = [{ wch: 8 }, { wch: 12 }, { wch: 20 }, { wch: 60 }, { wch: 10 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, wsRdo, 'RDOs')
  }

  return wb
}

// ─── EXCEL ESTOQUE DE MATERIAIS ───────────────────────────────────────────
export function exportMateriaisEstoque(project, materials, movements) {
  const wb = XLSX.utils.book_new()
  const now = new Date().toLocaleString('pt-BR')

  // Sheet 1: Resumo do Estoque
  const resumo = [
    [`CONTROLE DE ESTOQUE — ${project.name}`],
    [`Exportado em: ${now}`],
    [],
    ['Material', 'Etapa/Grupo', 'Unidade', 'Pedido', 'Recebido', 'Utilizado', 'Saldo Atual', 'Status'],
  ]
  materials.forEach(m => {
    const received = Number(m.received_qty) || 0
    const used     = Number(m.used_qty)     || 0
    const saldo    = Math.max(0, received - used)
    resumo.push([
      m.name,
      m.group_name || '',
      m.unit,
      Number(m.quantity) || 0,
      received,
      used,
      saldo,
      m.status || '',
    ])
  })
  const wsRes = XLSX.utils.aoa_to_sheet(resumo)
  wsRes['!cols'] = [{ wch: 35 }, { wch: 28 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, wsRes, 'Estoque')

  // Sheet 2: Movimentações (Log)
  const movRows = [
    [`MOVIMENTAÇÕES — ${project.name}`],
    [],
    ['Data/Hora', 'Material', 'Tipo', 'Quantidade', 'Unidade', 'Responsável', 'Observação'],
  ]
  if (movements && movements.length) {
    movements.forEach(mv => {
      const mat = materials.find(m => m.id === mv.material_id)
      movRows.push([
        new Date(mv.created_at).toLocaleString('pt-BR'),
        mat?.name || mv.material_id,
        mv.type === 'entrada' ? 'Entrada' : 'Saída',
        mv.quantity,
        mat?.unit || '',
        mv.profiles?.name || mv.profiles?.email || '',
        mv.notes || '',
      ])
    })
  } else {
    movRows.push(['Nenhuma movimentação registrada.'])
  }
  const wsMov = XLSX.utils.aoa_to_sheet(movRows)
  wsMov['!cols'] = [{ wch: 18 }, { wch: 35 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 22 }, { wch: 35 }]
  XLSX.utils.book_append_sheet(wb, wsMov, 'Movimentações')

  return wb
}

// ─── DOWNLOAD HELPERS ─────────────────────────────────────────────────────
export function downloadPDF(doc, fileName) {
  try {
    doc.save(fileName)
  } catch {
    // fallback via blob URL
    const blob = doc.output('blob')
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
}

export function downloadExcel(wb, fileName) {
  try {
    // Use blob URL approach for browser compatibility (avoids XLSX.writeFile FileSaver issues)
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('downloadExcel error:', err)
    throw err
  }
}

export function docToBlob(doc) {
  return doc.output('blob')
}

export function wbToBlob(wb) {
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
