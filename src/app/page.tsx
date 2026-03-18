import { redirect } from 'next/navigation';

export default function Home() {
  // Redirigir siempre a la página de login por defecto
  redirect('/login');
}
