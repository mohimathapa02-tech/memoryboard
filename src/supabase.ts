import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://msamxbxpfdwncplbjjid.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zYW14YnhwZmR3bmNwbGJqamlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjAyMTIsImV4cCI6MjA4ODUzNjIxMn0.Oj7rMFyDZF6XHSuU9PBjbUC9rt2481fY3x120CRP4FA'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export async function loadBoard(id: string) {
  const { data, error } = await supabase
    .from('boards')
    .select('data')
    .eq('id', id)
    .single()
  if (error || !data) return null
  return data.data as { items: unknown[] }
}

export async function saveBoard(id: string, items: unknown[]) {
  const { error } = await supabase
    .from('boards')
    .upsert({ id, data: { items }, updated_at: new Date().toISOString() })
  if (error) console.error('Supabase saveBoard error:', error)
  return !error
}
