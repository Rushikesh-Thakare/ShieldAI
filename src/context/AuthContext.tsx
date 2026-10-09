import React, { createContext, useContext, useEffect, useState } from 'react'
import type {
  AuthError,
  AuthResponse,
  Session,
  SignInWithPasswordCredentials,
  SignUpWithPasswordCredentials,
  User,
} from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from '../lib/supabase'

export interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  isConfigured: boolean
  signInWithPassword: (credentials: SignInWithPasswordCredentials) => Promise<AuthResponse>
  signUpWithPassword: (credentials: SignUpWithPasswordCredentials) => Promise<AuthResponse>
  signOut: () => Promise<{ error: AuthError | null }>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isConfigured: false,
  signInWithPassword: async () => ({
    data: { user: null, session: null },
    error: null,
  }),
  signUpWithPassword: async () => ({
    data: { user: null, session: null },
    error: null,
  }),
  signOut: async () => ({ error: null }),
})

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    // Initial session retrieval
    void supabase.auth
      .getSession()
      .then(({ data: { session: initialSession } }) => {
        setSession(initialSession)
        setUser(initialSession?.user ?? null)
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })

    // Listen for session updates and synchronize state
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession)
      setUser(currentSession?.user ?? null)
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signInWithPassword = async (
    credentials: SignInWithPasswordCredentials
  ): Promise<AuthResponse> => {
    if (!supabase) {
      const err = new Error('Supabase client is not configured.') as unknown as AuthError
      return { data: { user: null, session: null }, error: err }
    }
    return await supabase.auth.signInWithPassword(credentials)
  }

  const signUpWithPassword = async (
    credentials: SignUpWithPasswordCredentials
  ): Promise<AuthResponse> => {
    if (!supabase) {
      const err = new Error('Supabase client is not configured.') as unknown as AuthError
      return { data: { user: null, session: null }, error: err }
    }
    return await supabase.auth.signUp(credentials)
  }

  const signOut = async (): Promise<{ error: AuthError | null }> => {
    if (!supabase) {
      setSession(null)
      setUser(null)
      return { error: null }
    }
    const result = await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    return result
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isConfigured: supabaseConfigured,
        signInWithPassword,
        signUpWithPassword,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
