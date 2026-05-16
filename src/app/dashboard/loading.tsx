/**
 * Carga entre rutas bajo /dashboard: skeleton liviano para no tapar toda la UI
 * con el loader de marca (sensación de “demora” al cambiar de pestaña).
 */
export default function DashboardLoading() {
  return (
    <div
      className="mx-auto w-full max-w-7xl animate-pulse space-y-4 p-4 pb-28"
      aria-busy="true"
      aria-label="Cargando contenido"
    >
      <div className="h-9 w-2/3 max-w-md rounded-lg bg-white/10" />
      <div className="h-36 rounded-2xl bg-white/[0.06]" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-28 rounded-xl bg-white/[0.05]" />
        <div className="h-28 rounded-xl bg-white/[0.05]" />
      </div>
      <div className="h-48 rounded-2xl bg-white/[0.05]" />
    </div>
  )
}
