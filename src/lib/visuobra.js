import { createClient } from '@supabase/supabase-js'

const VISU_URL  = 'https://rlotfjvydycntthzbhpg.supabase.co'
const VISU_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsb3RmanZ5ZHljbnR0aHpiaHBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0NjYzNTgsImV4cCI6MjA3ODA0MjM1OH0.oD1zwL2qAmm1liOltsHfYVB2hgJl4g3sDUz3xSWWxIs'

export const visuobra = createClient(VISU_URL, VISU_ANON, {
  auth: { storageKey: 'visuobra_session' },
})

// Constrói URL pública de uma foto a partir do image_path
export const getVisuPhotoUrl = (imagePath) => {
  if (!imagePath) return null
  if (imagePath.startsWith('http')) return imagePath
  return `${VISU_URL}/storage/v1/object/public/imagens-obras/${imagePath}`
}

// Auth
export const signInVisuObra = (email, password) =>
  visuobra.auth.signInWithPassword({ email, password })

export const signOutVisuObra = () =>
  visuobra.auth.signOut()

export const getVisuSession = () =>
  visuobra.auth.getSession()

// Obras do usuário logado
export const fetchVisuObras = (userId) =>
  visuobra
    .from('obras')
    .select('id, nome, cidade, uf, status, data_inicio, data_fim, cliente')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

// Fotos (lançamentos com imagem) de uma obra
export const fetchVisuPhotos = (obraId) =>
  visuobra
    .from('lancamentos')
    .select('id, titulo, descricao, image_path, thumb_path, data_ref, created_at')
    .eq('obra_id', obraId)
    .not('image_path', 'is', null)
    .order('data_ref', { ascending: false })

// Busca uma obra pelo ID (para ClientView — acesso público)
export const fetchVisuObra = (obraId) =>
  visuobra
    .from('obras')
    .select('id, nome, cidade, uf, status')
    .eq('id', obraId)
    .single()
