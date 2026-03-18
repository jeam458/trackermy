import { createClient } from '@/core/infrastructure/supabase/server'
import { redirect } from 'next/navigation'
import LoginForm from './LoginForm'
import styles from './login.module.scss'

export default async function LoginPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className={`min-h-screen flex items-center justify-center bg-slate-900 ${styles.loginPage}`}>
      <div className={`w-full max-w-md p-8 space-y-8 bg-slate-800 rounded-3xl shadow-xl border border-slate-700 ${styles.loginCard}`}>
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            Downhill Tracker
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Sign in to track your best times and routes.
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
