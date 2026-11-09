import { useState, useEffect } from 'react'
import { C, FONT_BODY, FONT_DISPLAY } from '../tokens'
import { Btn, Badge, Alert, Spinner, Empty, Icon } from '../components/ui'
import {
  exportPDF,
  exportExcel,
  downloadPDF,
  downloadExcel,
  docToBlob,
  wbToBlob,
} from '../lib/export'
import {
  uploadReport,
  saveReport,
  fetchReports,
  deleteReport,
  getReportUrl,
} from '../lib/supabase'

const REPORT_TYPE_CFG = {
  pdf:   { bg: C.redLight,  cor: C.red,  label: 'PDF',   icon: 'file'     },
  excel: { bg: C.greenLight, cor: C.green, label: 'Excel', icon: 'download' },
}

function ReportCard({ title, description, type, icon, onGenerate, onSave, loading }) {
  const tc = REPORT_TYPE_CFG[type] || REPORT_TYPE_CFG.pdf
  return (
    <div style={{
      background: C.white,
      border: `1px solid ${C.gray200}`,
      borderRadius: 10,
      padding: '20px 24px',
      fontFamily: FONT_BODY,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 44, height: 44,
          background: tc.bg,
          borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon name={icon} size={20} color={tc.cor} />
        </div>
        <div>
          <div style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: 16,
            color: C.black,
            letterSpacing: '0.03em',
          }}>
            {title}
          </div>
          <Badge label={tc.label} cor={tc.cor} bg={tc.bg} />
        </div>
      </div>

      <div style={{ fontSize: 13, color: C.gray500, lineHeight: 1.5, marginBottom: 16 }}>
        {description}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Btn
          variant="primary"
          icon="download"
          size="sm"
          onClick={onGenerate}
          disabled={loading}
        >
          {loading ? 'Gerando...' : 'Gerar e baixar'}
        </Btn>
        <Btn
          variant="secondary"
          icon="upload"
          size="sm"
          onClick={onSave}
          disabled={loading}
        >
          {loading ? 'Salvando...' : 'Gerar e salvar'}
        </Btn>
      </div>
    </div>
  )
}

function SavedReportRow({ report, onDownload, onDelete }) {
  const [downloading, setDownloading] = useState(false)
  const tc = REPORT_TYPE_CFG[report.type] || REPORT_TYPE_CFG.pdf

  async function handleDownload() {
    setDownloading(true)
    try {
      await onDownload(report)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '10px 14px',
      borderBottom: `1px solid ${C.gray100}`,
      background: C.white,
    }}>
      <div style={{
        width: 32, height: 32,
        background: tc.bg,
        borderRadius: 7,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon name="file" size={14} color={tc.cor} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          color: C.black,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {report.name || report.file_name || 'Relatório'}
        </div>
        <div style={{ fontSize: 11, color: C.gray400, marginTop: 1 }}>
          {report.created_at
            ? new Date(report.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
            : '—'}
          {(report.profiles?.name || report.author_name) && ` · ${report.profiles?.name || report.author_name}`}
        </div>
      </div>

      <Badge label={tc.label} cor={tc.cor} bg={tc.bg} />

      <div style={{ display: 'flex', gap: 6 }}>
        <Btn
          variant="secondary"
          icon="download"
          size="sm"
          onClick={handleDownload}
          disabled={downloading}
        >
          {downloading ? '...' : 'Baixar'}
        </Btn>
        <button
          onClick={() => onDelete(report)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: C.red, display: 'flex', padding: 6, borderRadius: 4,
          }}
          title="Excluir relatório"
        >
          <Icon name="trash" size={14} color={C.red} />
        </button>
      </div>
    </div>
  )
}

export default function Reports({ project, activities = [], materials = [], rdos = [], baselines = [], userId }) {
  const [savedReports, setSavedReports] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingPDF, setLoadingPDF] = useState(false)
  const [loadingXLSX, setLoadingXLSX] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (project?.id) loadReports()
  }, [project?.id])

  async function loadReports() {
    setLoading(true)
    try {
      const { data, error: err } = await fetchReports(project.id)
      if (err) throw err
      setSavedReports(data || [])
    } catch (err) {
      setError(err.message || 'Erro ao carregar relatórios.')
    } finally {
      setLoading(false)
    }
  }

  function getFileName(type) {
    const date = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')
    const name = (project.name || 'obra').replace(/[^a-z0-9]/gi, '_').toLowerCase()
    return type === 'pdf'
      ? `${name}_relatorio_${date}.pdf`
      : `${name}_planilha_${date}.xlsx`
  }

  async function handleDownloadPDF() {
    setLoadingPDF(true)
    try {
      const doc = exportPDF(project, activities, materials, rdos, baselines)
      downloadPDF(doc, getFileName('pdf'))
    } catch (err) {
      setError(err.message || 'Erro ao gerar PDF.')
    } finally {
      setLoadingPDF(false)
    }
  }

  async function handleSavePDF() {
    setLoadingPDF(true)
    setError('')
    setMsg('')
    try {
      const doc = exportPDF(project, activities, materials, rdos, baselines)
      const blob = docToBlob(doc)
      const fileName = getFileName('pdf')
      const { path } = await uploadReport(project.id, fileName, blob)
      const { data, error: err } = await saveReport({
        project_id: project.id,
        user_id: userId,
        name: fileName,
        file_path: path,
        type: 'pdf',
        file_name: fileName,
      })
      if (err) throw err
      setSavedReports(prev => [data, ...prev])
      setMsg('PDF salvo com sucesso.')
      setTimeout(() => setMsg(''), 3000)
    } catch (err) {
      setError(err.message || 'Erro ao salvar PDF.')
    } finally {
      setLoadingPDF(false)
    }
  }

  async function handleDownloadExcel() {
    setLoadingXLSX(true)
    try {
      const wb = exportExcel(project, activities, materials, rdos)
      downloadExcel(wb, getFileName('excel'))
    } catch (err) {
      setError(err.message || 'Erro ao gerar Excel.')
    } finally {
      setLoadingXLSX(false)
    }
  }

  async function handleSaveExcel() {
    setLoadingXLSX(true)
    setError('')
    setMsg('')
    try {
      const wb = exportExcel(project, activities, materials, rdos)
      const blob = wbToBlob(wb)
      const fileName = getFileName('excel')
      const { path } = await uploadReport(project.id, fileName, blob)
      const { data, error: err } = await saveReport({
        project_id: project.id,
        user_id: userId,
        name: fileName,
        file_path: path,
        type: 'excel',
        file_name: fileName,
      })
      if (err) throw err
      setSavedReports(prev => [data, ...prev])
      setMsg('Planilha salva com sucesso.')
      setTimeout(() => setMsg(''), 3000)
    } catch (err) {
      setError(err.message || 'Erro ao salvar planilha.')
    } finally {
      setLoadingXLSX(false)
    }
  }

  async function handleDownloadSaved(report) {
    try {
      const storagePath = report.storage_path || report.file_path
      const { data, error: err } = await getReportUrl(storagePath)
      if (err) throw err
      window.open(data.signedUrl, '_blank')
    } catch (err) {
      setError(err.message || 'Erro ao obter URL do relatório.')
    }
  }

  async function handleDeleteReport(report) {
    if (!confirm(`Excluir "${report.name || 'este relatório'}"?`)) return
    try {
      const { error: err } = await deleteReport(report.id)
      if (err) throw err
      setSavedReports(prev => prev.filter(r => r.id !== report.id))
    } catch (err) {
      setError(err.message || 'Erro ao excluir relatório.')
    }
  }

  return (
    <div style={{ fontFamily: FONT_BODY }}>
      {/* Header */}
      <div style={{
        fontFamily: FONT_DISPLAY,
        fontWeight: 800,
        fontSize: 20,
        color: C.black,
        letterSpacing: '0.03em',
        marginBottom: 20,
      }}>
        RELATÓRIOS
      </div>

      {error && (
        <div style={{ marginBottom: 16 }}>
          <Alert type="error">{error}</Alert>
        </div>
      )}
      {msg && (
        <div style={{ marginBottom: 16 }}>
          <Alert type="success">{msg}</Alert>
        </div>
      )}

      {/* Export cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 16,
        marginBottom: 32,
      }}>
        <ReportCard
          title="Relatório de Obra"
          description="Documento PDF completo com cronograma de atividades, materiais, RDOs e indicadores de avanço. Ideal para envio ao cliente ou arquivo."
          type="pdf"
          icon="file"
          onGenerate={handleDownloadPDF}
          onSave={handleSavePDF}
          loading={loadingPDF}
        />
        <ReportCard
          title="Planilha de Controle"
          description="Arquivo Excel com abas separadas para cronograma, materiais e RDOs. Formato editável para análise e controle interno."
          type="excel"
          icon="chart"
          onGenerate={handleDownloadExcel}
          onSave={handleSaveExcel}
          loading={loadingXLSX}
        />
      </div>

      {/* Saved reports */}
      <div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}>
          <div style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: 16,
            color: C.black,
            letterSpacing: '0.03em',
          }}>
            RELATÓRIOS SALVOS
          </div>
          {loading ? (
            <Spinner />
          ) : (
            <span style={{
              fontSize: 11, color: C.gray500, background: C.gray100,
              padding: '2px 8px', borderRadius: 10, fontWeight: 600,
            }}>
              {savedReports.length}
            </span>
          )}
        </div>

        {savedReports.length === 0 && !loading ? (
          <div style={{
            background: C.white,
            border: `2px dashed ${C.gray200}`,
            borderRadius: 10,
            padding: '32px 24px',
            textAlign: 'center',
          }}>
            <Icon name="file" size={36} color={C.gray300} style={{ margin: '0 auto 10px' }} />
            <div style={{ fontSize: 14, color: C.gray500 }}>
              Nenhum relatório salvo ainda.
            </div>
            <div style={{ fontSize: 12, color: C.gray400, marginTop: 4 }}>
              Clique em "Gerar e salvar" para arquivar um relatório.
            </div>
          </div>
        ) : (
          <div style={{
            border: `1px solid ${C.gray200}`,
            borderRadius: 10,
            overflow: 'hidden',
          }}>
            {savedReports.map(r => (
              <SavedReportRow
                key={r.id}
                report={r}
                onDownload={handleDownloadSaved}
                onDelete={handleDeleteReport}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
