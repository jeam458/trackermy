'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/core/infrastructure/supabase/client'
import { Bike, Mail, Lock, Loader2, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react'

export default function LoginForm() {
  const router = useRouter()
  const supabase = createClient()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      if (isLogin) {
        // Login
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            throw new Error('Email o contraseña incorrectos')
          } else if (error.message.includes('Email not confirmed')) {
            throw new Error('Debes confirmar tu email. Revisa tu bandeja de entrada.')
          } else if (error.message.includes('rate limit')) {
            throw new Error('Demasiados intentos. Espera 15 minutos e intenta de nuevo.')
          } else {
            throw new Error(error.message)
          }
        }

        setSuccess('¡Inicio de sesión exitoso! Redirigiendo...')
        setTimeout(() => router.push('/dashboard'), 1000)
      } else {
        // Registro
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              fullName: email.split('@')[0],
            },
          },
        })

        if (error) {
          if (error.message.includes('User already registered')) {
            throw new Error('Este email ya está registrado. Intenta iniciar sesión.')
          } else if (error.message.includes('password')) {
            throw new Error('La contraseña debe tener al menos 6 caracteres')
          } else {
            throw new Error(error.message)
          }
        }

        setSuccess('¡Cuenta creada! Revisa tu email para confirmar y luego inicia sesión.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  // Login con Google
  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`,
        },
      })

      if (error) throw error
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error con Google')
      setGoogleLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-500/20 rounded-full mb-4">
          <Bike className="text-amber-500" size={32} />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">
          {isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
        </h1>
        <p className="text-gray-400">
          {isLogin ? 'Ingresa tus credenciales para continuar' : 'Regístrate para comenzar'}
        </p>
      </div>

      {/* Google Login */}
      <button
        onClick={handleGoogleLogin}
        disabled={googleLoading}
        className="w-full py-3 bg-white hover:bg-gray-100 disabled:bg-gray-300 text-gray-800 font-semibold rounded-xl transition-colors flex items-center justify-center gap-3 mb-4"
      >
        {googleLoading ? (
          <Loader2 className="animate-spin" size={20} />
        ) : (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M18.1713 8.36791H17.5001V8.33325H10.0001V11.6666H14.7096C14.0225 13.607 12.1763 14.9999 10.0001 14.9999C7.23882 14.9999 5.00007 12.7612 5.00007 9.99992C5.00007 7.23867 7.23882 4.99992 10.0001 4.99992C11.2746 4.99992 12.4342 5.48075 13.3171 6.26617L15.6742 3.909C14.1859 2.52217 12.1951 1.66659 10.0001 1.66659C5.39799 1.66659 1.66675 5.39784 1.66675 9.99992C1.66675 14.602 5.39799 18.3333 10.0001 18.3333C14.6021 18.3333 18.3334 14.602 18.3334 9.99992C18.3334 9.44117 18.2763 8.89575 18.1713 8.36791Z" fill="#FFC107"/>
            <path d="M2.62756 6.12117L5.36548 8.12909C6.10631 6.29534 7.90048 4.99992 10.0001 4.99992C11.2747 4.99992 12.4343 5.48075 13.3172 6.26617L15.6743 3.909C14.186 2.52217 12.1952 1.66659 10.0001 1.66659C6.79923 1.66659 4.02339 3.47367 2.62756 6.12117Z" fill="#FF3D00"/>
            <path d="M10.0001 18.3333C12.1526 18.3333 14.1084 17.5095 15.5871 16.1708L13.0076 13.9874C12.1439 14.6452 11.0859 15.0008 10.0001 14.9999C7.83256 14.9999 5.99215 13.6178 5.29882 11.6891L2.58215 13.7833C3.96048 16.4816 6.76131 18.3333 10.0001 18.3333Z" fill="#4CAF50"/>
            <path d="M18.1713 8.36805H17.5V8.33337H10V11.6667H14.7096C14.3809 12.5902 13.7889 13.3972 13.0067 13.988L13.0076 13.9874L15.5871 16.1708C15.4046 16.3366 18.3333 14.1667 18.3333 9.99999C18.3333 9.44124 18.2762 8.89582 18.1713 8.36805Z" fill="#1976D2"/>
          </svg>
        )}
        {googleLoading ? 'Conectando con Google...' : 'Continuar con Google'}
      </button>

      {/* Separador */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-700"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-[#1c2327] text-gray-400">o continúa con email</span>
        </div>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-white placeholder-gray-500"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">Contraseña</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="w-full pl-10 pr-12 py-3 bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-white placeholder-gray-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* Errores */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
            <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Éxito */}
        {success && (
          <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-start gap-2">
            <CheckCircle className="text-green-500 flex-shrink-0 mt-0.5" size={16} />
            <p className="text-sm text-green-400">{success}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:bg-gray-600 text-slate-900 font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              {isLogin ? 'Iniciando sesión...' : 'Creando cuenta...'}
            </>
          ) : (
            <>
              {isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
            </>
          )}
        </button>

        {/* Toggle login/register */}
        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin)
              setError(null)
              setSuccess(null)
            }}
            className="text-sm text-amber-500 hover:text-amber-400"
          >
            {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
          </button>
        </div>
      </form>

      {/* Info de bloqueo */}
      <div className="mt-6 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
        <h4 className="text-sm font-semibold text-white mb-2">⚠️ ¿Problemas para acceder?</h4>
        <ul className="text-xs text-gray-400 space-y-1">
          <li>• Si Supabase te bloqueó, espera 15-30 minutos</li>
          <li>• Verifica que tu email esté confirmado</li>
          <li>• Revisa la carpeta de spam</li>
          <li>• La contraseña debe tener al menos 6 caracteres</li>
        </ul>
      </div>
    </div>
  )
}
