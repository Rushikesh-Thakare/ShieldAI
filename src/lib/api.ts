import { supabase } from './supabase'

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  authenticated = true,
): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (authenticated) {
    if (!supabase) {
      throw new Error('Supabase client is not configured.')
    }
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    const accessToken = data.session?.access_token
    if (!accessToken) throw new Error('Sign in to continue.')
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const response = await fetch(path, { ...options, headers })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(typeof payload.error === 'string' ? payload.error : 'The request could not be completed.')
  }
  return payload as T
}
