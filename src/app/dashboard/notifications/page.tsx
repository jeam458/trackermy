'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/core/infrastructure/supabase/client'
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Loader2,
  MapPin,
  Trophy,
  ArrowLeft,
  Camera,
  Upload,
  X,
  Video,
  Play,
} from 'lucide-react'

interface Notification {
  id: string
  type: 'new_route' | 'new_record' | 'route_updated'
  title: string
  message: string
  route_id: string | null
  attempt_id: string | null
  is_read: boolean
  created_at: string
}

interface UserProfile {
  id: string
  full_name: string | null
  bio: string | null
  avatar_url: string | null
  bike_image_url: string | null
  bike_frame: string | null
  bike_fork: string | null
  bike_drivetrain: string | null
}

export default function NotificationsPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bikeFileInputRef = useRef<HTMLInputElement>(null)
  const videoFileInputRef = useRef<HTMLInputElement>(null)

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [activeTab, setActiveTab] = useState<'notifications' | 'profile'>('notifications')
  const [unreadCount, setUnreadCount] = useState(0)

  // Cargar datos
  useEffect(() => {
    loadData()
    
    // Suscribirse a nuevas notificaciones en tiempo real
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${getCurrentUserId()}`,
        },
        (payload) => {
          setNotifications(prev => [payload.new as Notification, ...prev])
          setUnreadCount(prev => prev + 1)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const getCurrentUserId = () => {
    // This will be set after loading user
    return ''
  }

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Cargar notificaciones
      const { data: notifs } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (notifs) {
        setNotifications(notifs)
        setUnreadCount(notifs.filter(n => !n.is_read).length)
      }

      // Cargar perfil
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileData) {
        setProfile(profileData)
      }
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  // Marcar notificación como leída
  const markAsRead = async (notifId: string) => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notifId)

    setNotifications(prev =>
      prev.map(n => n.id === notifId ? { ...n, is_read: true } : n)
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  // Marcar todas como leídas
  const markAllAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.rpc('mark_all_notifications_read', { p_user_id: user.id })

    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  // Subir foto de perfil
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/avatar.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      // Actualizar perfil
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id)

      if (updateError) throw updateError

      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null)
    } catch (error) {
      console.error('Error subiendo avatar:', error)
      alert('Error subiendo la foto')
    } finally {
      setUploading(false)
    }
  }

  // Subir foto de bicicleta
  const handleBikePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/bike.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('bike-photos')
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('bike-photos')
        .getPublicUrl(fileName)

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ bike_image_url: publicUrl })
        .eq('id', user.id)

      if (updateError) throw updateError

      setProfile(prev => prev ? { ...prev, bike_image_url: publicUrl } : null)
    } catch (error) {
      console.error('Error subiendo foto de bici:', error)
      alert('Error subiendo la foto')
    } finally {
      setUploading(false)
    }
  }

  // Guardar info del perfil
  const saveProfile = async () => {
    if (!profile) return

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: profile.full_name,
        bio: profile.bio,
        bike_frame: profile.bike_frame,
        bike_fork: profile.bike_fork,
        bike_drivetrain: profile.bike_drivetrain,
      })
      .eq('id', profile.id)

    if (error) {
      alert('Error guardando perfil')
    } else {
      alert('¡Perfil guardado!')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1c2327] flex items-center justify-center">
        <Loader2 className="animate-spin text-amber-500" size={40} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1c2327] text-slate-100">
      {/* Header */}
      <header className="bg-slate-900/50 backdrop-blur-sm border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-bold">
              {activeTab === 'notifications' ? 'Notificaciones' : 'Mi Perfil'}
            </h1>
            <div className="w-10" />
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('notifications')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'notifications'
                  ? 'bg-amber-500 text-slate-900'
                  : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
              }`}
            >
              <Bell size={18} />
              Notificaciones
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'profile'
                  ? 'bg-amber-500 text-slate-900'
                  : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
              }`}
            >
              <Camera size={18} />
              Perfil
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4">
        {/* Tab: Notificaciones */}
        {activeTab === 'notifications' && (
          <div className="space-y-4">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <CheckCheck size={16} />
                Marcar todas como leídas
              </button>
            )}

            {notifications.length === 0 ? (
              <div className="text-center py-12">
                <BellOff className="mx-auto text-gray-500 mb-4" size={48} />
                <h3 className="text-xl font-bold text-white mb-2">Sin notificaciones</h3>
                <p className="text-gray-400">
                  Te notificaremos cuando haya nuevas rutas o récords
                </p>
              </div>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  onClick={() => {
                    if (!notif.is_read) markAsRead(notif.id)
                    if (notif.route_id) {
                      router.push(`/dashboard/routes/${notif.route_id}`)
                    }
                  }}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    notif.is_read
                      ? 'bg-slate-800/30 border-slate-700/50'
                      : 'bg-amber-500/10 border-amber-500/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-700/50 rounded-lg">
                      {notif.type === 'new_route' ? (
                        <MapPin className="text-green-400" size={20} />
                      ) : notif.type === 'new_record' ? (
                        <Trophy className="text-amber-400" size={20} />
                      ) : (
                        <Bell className="text-blue-400" size={20} />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-semibold text-white">{notif.title}</h4>
                        {!notif.is_read && (
                          <div className="w-2 h-2 bg-amber-500 rounded-full" />
                        )}
                      </div>
                      <p className="text-sm text-gray-400 mb-2">{notif.message}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(notif.created_at).toLocaleString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab: Perfil */}
        {activeTab === 'profile' && profile && (
          <div className="space-y-6">
            {/* Foto de perfil */}
            <div className="text-center">
              <div className="relative inline-block">
                <div className="w-32 h-32 rounded-full bg-slate-700 border-4 border-amber-500/30 overflow-hidden mx-auto">
                  {profile.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.avatar_url}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                      <Camera size={40} />
                    </div>
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute bottom-0 right-0 p-2 bg-amber-500 hover:bg-amber-400 disabled:bg-gray-600 rounded-full transition-colors"
                >
                  {uploading ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <Camera size={16} className="text-slate-900" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </div>
              <p className="text-sm text-gray-400 mt-2">Click para cambiar foto de perfil</p>
            </div>

            {/* Info del perfil */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Nombre</label>
                <input
                  type="text"
                  value={profile.full_name || ''}
                  onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-white"
                  placeholder="Tu nombre"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Bio</label>
                <textarea
                  value={profile.bio || ''}
                  onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-white resize-none"
                  placeholder="Cuéntanos sobre ti..."
                />
              </div>

              <button
                onClick={saveProfile}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-xl transition-colors"
              >
                Guardar Cambios
              </button>
            </div>

            {/* Foto de bicicleta */}
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Camera size={18} className="text-amber-500" />
                Mi Bicicleta
              </h3>

              <div className="relative mb-4">
                <div className="h-48 bg-slate-700 rounded-xl overflow-hidden">
                  {profile.bike_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.bike_image_url}
                      alt="Mi bicicleta"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                      <Camera size={40} />
                    </div>
                  )}
                </div>
                <button
                  onClick={() => bikeFileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute bottom-2 right-2 p-2 bg-amber-500 hover:bg-amber-400 disabled:bg-gray-600 rounded-lg transition-colors"
                >
                  {uploading ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <Upload size={16} className="text-slate-900" />
                  )}
                </button>
                <input
                  ref={bikeFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleBikePhotoUpload}
                  className="hidden"
                />
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Frame</label>
                  <input
                    type="text"
                    value={profile.bike_frame || ''}
                    onChange={(e) => setProfile({ ...profile, bike_frame: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-white text-sm"
                    placeholder="Ej: Carbon 29&quot;"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Fork</label>
                  <input
                    type="text"
                    value={profile.bike_fork || ''}
                    onChange={(e) => setProfile({ ...profile, bike_fork: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-white text-sm"
                    placeholder="Ej: RockShox Lyrik"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Drivetrain</label>
                  <input
                    type="text"
                    value={profile.bike_drivetrain || ''}
                    onChange={(e) => setProfile({ ...profile, bike_drivetrain: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-white text-sm"
                    placeholder="Ej: SRAM GX Eagle"
                  />
                </div>
              </div>
            </div>

            {/* Videos de intentos */}
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Video size={18} className="text-amber-500" />
                Videos de Intentos
              </h3>
              <p className="text-sm text-gray-400 mb-4">
                Sube videos de tus mejores bajadas para compartir con la comunidad
              </p>
              <button
                onClick={() => videoFileInputRef.current?.click()}
                disabled={uploading}
                className="w-full py-3 bg-slate-700 hover:bg-slate-600 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <>
                    <Upload size={18} />
                    Subir Video
                  </>
                )}
              </button>
              <input
                ref={videoFileInputRef}
                type="file"
                accept="video/*"
                onChange={(e) => {
                  // TODO: Implementar subida de videos
                  alert('Funcionalidad de videos próximamente!')
                }}
                className="hidden"
              />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
