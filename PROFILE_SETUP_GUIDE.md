# 📋 Configurar Tablas de Perfil en Supabase

## ⚠️ IMPORTANTE - Lee Esto Primero

Para que el perfil guarde los datos (nombre, foto, bicicleta, rutas favoritas), necesitas crear las tablas en Supabase.

---

## 🎯 Paso 1: Ejecutar el SQL en Supabase

### 1. Abre Supabase Dashboard
- Ve a: https://supabase.com/dashboard
- Selecciona tu proyecto
- Click en **"SQL Editor"** (menú lateral)
- Click en **"+ New Query"**

### 2. Copia y Ejecuta el SQL

Abre este archivo y copia TODO el contenido:
```
C:\Users\jeam\Desktop\app bike\supabase\schema-profiles.sql
```

Pega el SQL en el editor de Supabase y click en **"Run"**.

Debería decir **"Success. No rows returned"**.

---

## 🎯 Paso 2: Verificar que se Creó Todo

Ejecuta este SQL para verificar:

```sql
-- Verificar tablas de perfil
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('profiles', 'bike_setups', 'user_routes');
```

**Resultado esperado:**
```
table_name
--------------
profiles
bike_setups
user_routes
```

Si ves las 3 tablas, ¡todo está correcto! ✅

---

## 🎯 Paso 3: Probar el Perfil

### 1. Reinicia tu app
```bash
npm run dev
```

### 2. Ve a tu perfil
- URL: `/dashboard/profile`
- Debería cargar tu perfil (posiblemente vacío)

### 3. Edita tu perfil
- Click en el botón de engranaje (editar)
- Modifica:
  - ✅ Tu nombre
  - ✅ Tu bio/descripción
  - ✅ Foto de perfil (URL)
  - ✅ Foto de bicicleta (URL)
  - ✅ Componentes de la bici (frame, fork, drivetrain)
  - ✅ Rutas favoritas
- Click en **"Guardar"** (ícono de diskette)

### 4. Verifica que se guardó
- Debería salir una alerta: "¡Perfil guardado exitosamente!"
- Recarga la página (F5)
- Tus cambios deberían persistir ✅

---

## 📊 ¿Qué se Guarda en Supabase?

### Tabla: `profiles`
| Campo | Qué Guarda |
|-------|-----------|
| `full_name` | Tu nombre/nickname |
| `bio` | Tu descripción |
| `avatar_url` | URL de tu foto de perfil |
| `has_crown` | Si tienes corona (logro) |

### Tabla: `bike_setups`
| Campo | Qué Guarda |
|-------|-----------|
| `frame` | Cuadro de tu bici |
| `fork` | Horquilla/suspensión |
| `drivetrain` | Transmisión |
| `image_url` | Foto de tu bicicleta |

### Tabla: `user_routes`
| Campo | Qué Guarda |
|-------|-----------|
| `route_id` | ID de la ruta favorita |
| `is_preferred` | Si es favorita |

---

## 🔧 Solución de Problemas

### Error: "Usuario no autenticado"
**Causa:** No has iniciado sesión

**Solución:**
1. Ve a `/login`
2. Inicia sesión
3. Vuelve a `/dashboard/profile`

### Error: "relation 'public.profiles' does not exist"
**Causa:** No ejecutaste el SQL del schema

**Solución:**
1. Ejecuta `schema-profiles.sql` en Supabase SQL Editor
2. Reinicia la app

### Error: "new row violates row-level security policy"
**Causa:** Las políticas RLS están mal configuradas

**Solución:**
1. Verifica que el trigger `on_auth_user_created` exista
2. Re-ejecuta el schema-profiles.sql completo

### El perfil no carga datos
**Causa:** El perfil no existe en la base de datos

**Solución:**
1. Cierra sesión
2. Vuelve a iniciar sesión (esto crea el perfil automáticamente)
3. O ejecuta manualmente:
```sql
INSERT INTO public.profiles (id, full_name, avatar_url)
VALUES (
  'TU_USER_ID',  -- Reemplaza con tu ID de auth.users
  'Tu Nombre',
  'https://api.dicebear.com/7.x/notionists/svg?seed=TuNombre'
);
```

---

## 🎉 Características del Perfil

### ✅ Lo que SÍ se guarda:
- Nombre/nickname
- Bio/descripción
- URL de foto de perfil
- URL de foto de bicicleta
- Componentes (frame, fork, drivetrain)
- Rutas favoritas seleccionadas

### ⚠️ Lo que NO se guarda (aún):
- Foto de perfil subida (solo URL)
- Foto de bicicleta subida (solo URL)
- Múltiples configuraciones de bicicleta

---

## 💡 Tips

### URLs para Fotos de Perfil
Puedes usar:
- **DiceBear**: https://api.dicebear.com/7.x/notionists/svg?seed=TuNombre
- **UI Avatars**: https://ui-avatars.com/api/?name=Tu+Nombre
- **Unsplash**: https://source.unsplash.com/random/200x200/?portrait

### URLs para Fotos de Bicicleta
- **Unsplash**: https://images.unsplash.com/photo-1532298229144-0ec0c57515c7
- **Imgur**: Sube tu foto y usa el link directo

---

## 📞 Soporte

Si tienes problemas:
1. Revisa la consola del navegador (F12)
2. Revisa los logs de Supabase (Dashboard → Logs)
3. Verifica que las tablas existen

---

**¡Listo! Ahora tu perfil guarda todo en Supabase** 🎉
