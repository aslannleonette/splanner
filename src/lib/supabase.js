import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)

// Cliente público sem estado de auth — usado no ClientView (link do cliente)
// Garante que nunca envia JWT expirado de sessão anterior
export const supabasePublic = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInTab: false },
})

// ─── AUTH ─────────────────────────────────────────────────────────────────
export const signUp = (email, password, options = {}) =>
  supabase.auth.signUp({
    email,
    password,
    options: {
      ...options,
      emailRedirectTo: 'https://www.splanner.com.br',
    },
  })

export const signIn = (email, password) =>
  supabase.auth.signInWithPassword({ email, password })

export const signOut = () => supabase.auth.signOut()

export const getSession = () => supabase.auth.getSession()

// ─── PROJECTS ─────────────────────────────────────────────────────────────
export const fetchProjects = (userId) =>
  supabase
    .from('projects')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })

export const fetchCollabProjects = (userId) =>
  supabase
    .from('project_collaborators')
    .select('role, projects(*)')
    .eq('user_id', userId)

export const createProject = (data) =>
  supabase.from('projects').insert(data).select().single()

export const updateProject = (id, data) =>
  supabase.from('projects').update(data).eq('id', id).select().single()

export const deleteProject = (id) =>
  supabase.from('projects').delete().eq('id', id)

export const fetchProjectByToken = (token) =>
  supabase.from('projects').select('*').eq('client_token', token).single()

// ─── ACTIVITIES ───────────────────────────────────────────────────────────
export const fetchActivities = (projectId) =>
  supabase
    .from('activities')
    .select('*')
    .eq('project_id', projectId)
    .order('order_index')

export const upsertActivities = (activities) => {
  // Sanitize: only send columns that exist in the DB
  const rows = activities
    .filter(a => a.name && a.name.trim())   // skip blank-name placeholders
    .map(a => ({
      id:             a.id,
      project_id:     a.project_id,
      name:           a.name.trim(),
      group_name:     a.group_name || 'Geral',
      week_start:     a.week_start  || 1,
      week_end:       a.week_end    || 1,
      tipo:           a.tipo        || 'exec',
      pct:            a.pct         ?? 0,
      status:         a.status      || 'nao_iniciado',
      observacoes:    a.observacoes || null,
      order_index:    a.order_index ?? 0,
      completed_week: a.completed_week ?? null,
      workers:        a.workers        ?? [],
      equipment:      a.equipment      ?? [],
      doc_notes:      a.doc_notes      ?? null,
    }))
  return supabase.from('activities').upsert(rows, { onConflict: 'id' })
}

export const deleteActivity = (id) =>
  supabase.from('activities').delete().eq('id', id)

// Creates a single new activity/node — used by the "+ Nova etapa" button on
// the Fluxograma canvas (doesn't require going through the full editor).
export const createActivity = (row) =>
  supabase.from('activities').insert(row).select().single()

// Lightweight single-field patch — used by the Fluxograma canvas (drag position,
// connect/disconnect dependencies) so we don't have to re-upsert every activity.
export const updateActivityFields = (id, fields) =>
  supabase.from('activities').update(fields).eq('id', id).select().single()

// ─── BASELINES ────────────────────────────────────────────────────────────
export const fetchBaselines = (projectId) =>
  supabase
    .from('baselines')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at')

export const createBaseline = (projectId, activities, name = 'Baseline Inicial') =>
  supabase.from('baselines').insert({ project_id: projectId, activities, name }).select().single()

// ─── MATERIALS ────────────────────────────────────────────────────────────
export const fetchMaterials = (projectId) =>
  supabase
    .from('materials')
    .select('*')
    .eq('project_id', projectId)
    .order('week')

export const upsertMaterial = (data) => {
  // Strip virtual/enriched fields that don't exist in the DB
  const { activity_name, ...rest } = data
  const row = { ...rest }
  if (row.activity_id === '' || row.activity_id === undefined) row.activity_id = null
  return supabase.from('materials').upsert(row, { onConflict: 'id' }).select().single()
}

export const deleteMaterial = (id) =>
  supabase.from('materials').delete().eq('id', id)

export const updateMaterialStatus = (id, status) =>
  supabase.from('materials').update({ status }).eq('id', id).select().single()

// ─── MATERIAL MOVEMENTS (log de entrada/saída) ────────────────────────────
export const fetchMaterialMovements = (materialId) =>
  supabase
    .from('material_movements')
    .select('*, profiles(name, email)')
    .eq('material_id', materialId)
    .order('created_at', { ascending: false })

export const createMaterialMovement = (data) =>
  supabase.from('material_movements').insert(data).select('*, profiles(name, email)').single()

export const fetchProjectMovements = (projectId) =>
  supabase
    .from('material_movements')
    .select('*, profiles(name, email)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

// ─── RDOS ─────────────────────────────────────────────────────────────────
export const fetchRdos = (projectId) =>
  supabase
    .from('rdos')
    .select('*, profiles(name, email)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

export const createRdo = (data) =>
  supabase.from('rdos').insert(data).select().single()

// ─── AI LOGS ──────────────────────────────────────────────────────────────
export const fetchAiLogs = (projectId) =>
  supabase
    .from('ai_logs')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

export const saveAiLog = (data) =>
  supabase.from('ai_logs').insert(data).select().single()

export const deleteAiLog = (id) =>
  supabase.from('ai_logs').delete().eq('id', id)

// ─── COLLABORATORS ────────────────────────────────────────────────────────
export const fetchCollaborators = (projectId) =>
  supabase
    .from('project_collaborators')
    .select('*, profiles(name, email, avatar_url)')
    .eq('project_id', projectId)

export const inviteCollaborator = (projectId, userId, role = 'viewer') =>
  supabase.from('project_collaborators').insert({ project_id: projectId, user_id: userId, role }).select().single()

export const updateCollaboratorRole = (id, role) =>
  supabase.from('project_collaborators').update({ role }).eq('id', id)

export const removeCollaborator = (id) =>
  supabase.from('project_collaborators').delete().eq('id', id)

export const findUserByEmail = (email) =>
  supabase.from('profiles').select('id, name, email').eq('email', email).single()

// ─── REPORTS ──────────────────────────────────────────────────────────────
// Columns: id, project_id, author_id, type, name, storage_path, size_bytes, created_at, file_name
export const fetchReports = (projectId) =>
  supabase
    .from('reports')
    .select('*, profiles!author_id(name)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

export const saveReport = ({ project_id, user_id, name, file_path, type, file_name }) =>
  supabase
    .from('reports')
    .insert({
      project_id,
      author_id:    user_id,       // column is author_id
      name,
      storage_path: file_path,     // column is storage_path
      type:         type || 'pdf',
      file_name:    file_name || name,
    })
    .select()
    .single()

export const deleteReport = (id) =>
  supabase.from('reports').delete().eq('id', id)

// Tag an existing project report to a specific activity — shown in the
// Fluxograma node's "Relatório" tab.
export const linkReportToActivity = (reportId, activityId) =>
  supabase.from('reports').update({ activity_id: activityId }).eq('id', reportId).select().single()

export const unlinkReportFromActivity = (reportId) =>
  supabase.from('reports').update({ activity_id: null }).eq('id', reportId).select().single()

// ─── PROJECT PHOTOS (VisuObra) ────────────────────────────────────────────
const PHOTOS_BUCKET = 'project-photos'

export const fetchPhotos = (projectId) =>
  supabase
    .from('project_photos')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

export const uploadPhoto = async ({ projectId, userId, file, caption, groupName, week }) => {
  const ext = file.name.split('.').pop()
  const path = `${projectId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

  const { error: upErr } = await supabase.storage.from(PHOTOS_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })
  if (upErr) return { error: upErr }

  const { data: { publicUrl } } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(path)

  return supabase.from('project_photos').insert({
    project_id:   projectId,
    user_id:      userId,
    storage_path: path,
    url:          publicUrl,
    caption:      caption || null,
    group_name:   groupName || null,
    week:         week || null,
  }).select().single()
}

export const deletePhoto = async ({ id, storagePath }) => {
  await supabase.storage.from(PHOTOS_BUCKET).remove([storagePath])
  return supabase.from('project_photos').delete().eq('id', id)
}

// ─── STORAGE ──────────────────────────────────────────────────────────────
export const uploadReport = async (projectId, fileName, blob) => {
  const path = `${projectId}/${Date.now()}_${fileName}`
  const { data, error } = await supabase.storage.from('reports').upload(path, blob)
  if (error) throw error
  return { path: data.path }
}

export const getReportUrl = (storagePath) =>
  supabase.storage.from('reports').createSignedUrl(storagePath, 3600)

// ─── PROFILE ──────────────────────────────────────────────────────────────
export const fetchProfile = (id) =>
  supabase.from('profiles').select('*').eq('id', id).single()

export const updateProfile = (id, data) =>
  supabase.from('profiles').update(data).eq('id', id).select().single()

// ─── ACTIVITY DOCUMENTS ───────────────────────────────────────────────────
const DOCS_BUCKET = 'activity-docs'

export const fetchActivityDocs = (activityId) =>
  supabase
    .from('activity_documents')
    .select('*, profiles(name, email)')
    .eq('activity_id', activityId)
    .order('created_at', { ascending: false })

export const uploadActivityDoc = async ({ activityId, projectId, userId, file, discipline, docName }) => {
  const { data: existing } = await supabase
    .from('activity_documents')
    .select('revision')
    .eq('activity_id', activityId)
    .eq('discipline', discipline)
    .eq('doc_name', docName)
    .order('revision', { ascending: false })
    .limit(1)
  const nextRev = existing?.[0] ? existing[0].revision + 1 : 0
  const action  = nextRev === 0 ? 'insert' : 'revision'
  const revStr  = String(nextRev).padStart(2, '0')
  const ext     = file.name.split('.').pop()
  const safe    = `${discipline}_${docName}`.replace(/[^a-zA-Z0-9_\-.]/g, '_')
  const path    = `${projectId}/${activityId}/${safe}_Rev${revStr}_${Date.now()}.${ext}`

  const { error: upErr } = await supabase.storage.from(DOCS_BUCKET).upload(path, file, {
    cacheControl: '3600', upsert: false,
  })
  if (upErr) return { error: upErr }

  if (nextRev > 0) {
    await supabase.from('activity_documents')
      .update({ is_current: false })
      .eq('activity_id', activityId)
      .eq('discipline', discipline)
      .eq('doc_name', docName)
  }

  return supabase.from('activity_documents').insert({
    activity_id:  activityId,
    project_id:   projectId,
    discipline,
    doc_name:     docName,
    revision:     nextRev,
    storage_path: path,
    file_name:    file.name,
    file_size:    file.size,
    file_type:    file.type || null,
    uploaded_by:  userId,
    action,
    is_current:   true,
  }).select('*, profiles(name, email)').single()
}

export const getActivityDocUrl = (storagePath) =>
  supabase.storage.from(DOCS_BUCKET).createSignedUrl(storagePath, 3600)

export const deleteActivityDoc = async ({ id, storagePath }) => {
  if (storagePath) await supabase.storage.from(DOCS_BUCKET).remove([storagePath])
  return supabase.from('activity_documents').delete().eq('id', id)
}
