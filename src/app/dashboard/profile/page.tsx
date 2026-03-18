'use client'

import { useState, useEffect } from 'react'
import { Settings, Save, X, PlusCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/core/infrastructure/supabase/client'
import { ProfileRepository } from '@/core/infrastructure/repositories/ProfileRepository'
import { UserHeader } from '@/components/profile/UserHeader'
import { BikeSetupCard } from '@/components/profile/BikeSetupCard'
import { RouteSelectionModal } from '@/components/profile/RouteSelectionModal'
import { PreferredRoutes } from '@/components/profile/PreferredRoutes'

const profileRepo = new ProfileRepository()

export default function ProfilePage() {
  const [isLoading, setIsLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  
  // UI States
  const [isEditing, setIsEditing] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Data States
  const [user, setUser] = useState({
    name: '',
    bio: '',
    avatarUrl: '',
    hasCrown: false,
  })
  const [bike, setBike] = useState({
    frame: '',
    fork: '',
    drivetrain: '',
    imageUrl: '',
  })
  const [selectedRouteIds, setSelectedRouteIds] = useState<string[]>([])

  // Cargar datos del perfil
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const supabase = createClient()
        const { data: { user: supaUser } } = await supabase.auth.getUser()

        if (!supaUser) {
          console.warn('Usuario no autenticado')
          return
        }

        setUserId(supaUser.id)

        // Cargar perfil completo
        const profile = await profileRepo.getProfile(supaUser.id)
        
        if (profile) {
          setUser({
            name: profile.full_name || supaUser.email?.split('@')[0] || 'Usuario',
            bio: profile.bio || '',
            avatarUrl: profile.avatar_url || '',
            hasCrown: profile.has_crown || false,
          })
          setBike({
            frame: profile.frame || '',
            fork: profile.fork || '',
            drivetrain: profile.drivetrain || '',
            imageUrl: profile.bike_image_url || '',
          })
        }

        // Cargar rutas favoritas
        const preferredRoutes = await profileRepo.getPreferredRoutes(supaUser.id)
        setSelectedRouteIds(preferredRoutes)

      } catch (error) {
        console.error('Error cargando perfil:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadProfile()
  }, [])

  // Handlers
  const handleToggleRoute = (routeId: string) => {
    setSelectedRouteIds(prev =>
      prev.includes(routeId) ? prev.filter(id => id !== routeId) : [...prev, routeId]
    )
  }

  const handleSave = async () => {
    if (!userId) {
      alert('Usuario no autenticado')
      return
    }

    setIsSaving(true)

    try {
      // Guardar perfil y rutas favoritas
      await profileRepo.saveCompleteProfile(
        userId,
        {
          full_name: user.name,
          bio: user.bio,
          avatar_url: user.avatarUrl,
          has_crown: user.hasCrown,
        },
        {
          frame: bike.frame,
          fork: bike.fork,
          drivetrain: bike.drivetrain,
          image_url: bike.imageUrl,
        },
        selectedRouteIds
      )

      alert('¡Perfil guardado exitosamente!')
      setIsEditing(false)
    } catch (error) {
      console.error('Error guardando perfil:', error)
      alert('Error guardando el perfil. Inténtalo de nuevo.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    // Recargar datos originales
    if (userId) {
      profileRepo.getProfile(userId).then(profile => {
        if (profile) {
          setUser({
            name: profile.full_name || '',
            bio: profile.bio || '',
            avatarUrl: profile.avatar_url || '',
            hasCrown: profile.has_crown || false,
          })
          setBike({
            frame: profile.frame || '',
            fork: profile.fork || '',
            drivetrain: profile.drivetrain || '',
            imageUrl: profile.bike_image_url || '',
          })
        }
      })
    }
    setIsEditing(false)
  }

  // Derived state - Mostrar rutas seleccionadas (se cargarán del modal)
  const selectedRoutesData = selectedRouteIds.map(id => ({
    id,
    name: 'Cargando...',
    difficulty: 'Intermediate' as const,
    distance: '-',
    location: 'Cusco, Perú'
  }))

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1c2327] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto text-amber-500 mb-4" size={40} />
          <p className="text-gray-400">Cargando perfil...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1c2327] text-slate-100 p-4 font-sans selection:bg-amber-500/30">
      <div className="max-w-md mx-auto space-y-8 pb-24">
        {/* Header Bar */}
        <header className="flex justify-between items-center pt-8">
          <h1 className="text-xl font-bold opacity-0">Perfil</h1>
          <div className="flex gap-2">
            {/* Botón Crear Nueva Ruta */}
            <Link
              href="/dashboard/routes/create"
              className="p-2 text-green-400 hover:text-green-300 bg-green-500/20 hover:bg-green-500/30 rounded-full transition-colors"
              title="Crear nueva ruta"
            >
              <PlusCircle size={20} />
            </Link>

            {isEditing ? (
              <>
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-full transition-colors disabled:opacity-50"
                >
                  <X size={20} />
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="p-2 text-[#1e2529] bg-amber-500 hover:bg-amber-400 rounded-full transition-colors disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                </button>
              </>
            ) : (
              <button 
                onClick={() => setIsEditing(true)}
                className="p-2 opacity-70 hover:opacity-100 transition-opacity bg-slate-800 rounded-full"
              >
                <Settings size={20} className="text-slate-200" />
              </button>
            )}
          </div>
        </header>

        {/* Modular Components */}
        <UserHeader 
          {...user} 
          isEditing={isEditing}
          onNameChange={(name) => setUser({ ...user, name })}
          onBioChange={(bio) => setUser({ ...user, bio })}
          onAvatarClick={() => alert('Simular apertura de galería para foto de perfil')}
        />
        
        <BikeSetupCard 
          {...bike} 
          isEditing={isEditing}
          onFrameChange={(frame) => setBike({ ...bike, frame })}
          onForkChange={(fork) => setBike({ ...bike, fork })}
          onDrivetrainChange={(drivetrain) => setBike({ ...bike, drivetrain })}
          onImageClick={() => alert('Simular apertura de cámara/galería para foto de bicicleta')}
        />
        
        <PreferredRoutes 
          selectedRoutes={selectedRoutesData} 
          isEditing={isEditing}
          onAddRouteClick={() => setIsModalOpen(true)}
        />
      </div>

      <RouteSelectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedRouteIds={selectedRouteIds}
        onToggleRoute={handleToggleRoute}
      />
    </div>
  )
}


