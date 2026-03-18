# 📋 Guía Paso a Paso - Configurar Base de Datos en Supabase

## ⚠️ IMPORTANTE: Esto es NECESARIO para que las rutas se guarden

Las tablas de la base de datos **NO se crean automáticamente**. Debes ejecutar el script SQL manualmente en Supabase.

---

## 🎯 Paso 1: Ingresar a Supabase

1. Abre tu navegador
2. Ve a: **https://supabase.com/dashboard**
3. Inicia sesión con tu cuenta
4. Selecciona tu proyecto de la app bike

---

## 🎯 Paso 2: Abrir SQL Editor

1. En el menú lateral izquierdo, busca **"SQL Editor"**
2. Haz click en **"SQL Editor"**
3. Click en el botón **"+ New Query"** (esquina superior derecha)

![SQL Editor](https://supabase.com/docs/img/guides/sql-editor.png)

---

## 🎯 Paso 3: Copiar el Esquema SQL

### Opción A: Desde el Archivo

1. Abre el archivo en tu proyecto:
   ```
   C:\Users\jeam\Desktop\app bike\supabase\schema-routes.sql
   ```

2. Selecciona TODO el contenido (Ctrl + A)
3. Copia el contenido (Ctrl + C)

### Opción B: Usar el Contenido de Abajo

Copia TODO el siguiente código SQL (desde `-- ============================================` hasta el final):

---

## 🎯 Paso 4: Pegar y Ejecutar

1. **Pega** el SQL en el editor de Supabase (Ctrl + V)
2. Verifica que se vea todo el código (debe tener ~320 líneas)
3. Click en el botón **"Run"** o presiona `Ctrl + Enter`
4. Espera a que aparezca **"Success"** en la parte inferior

---

## 🎯 Paso 5: Verificar que se Creó Todo

### Verificar Tablas

Ejecuta este SQL en el editor:

```sql
-- Verificar tablas creadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('routes', 'route_track_points');
```

**Resultado esperado:**
```
table_name
--------------
routes
route_track_points
```

### Verificar Funciones

```sql
-- Verificar funciones creadas
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public';
```

**Resultado esperado:**
```
routine_name
---------------------------
get_route_with_points
calculate_distance_meters
update_route_stats
update_updated_at_column
```

### Verificar Triggers

```sql
-- Verificar triggers
SELECT trigger_name 
FROM information_schema.triggers 
WHERE trigger_schema = 'public';
```

**Resultado esperado:**
```
trigger_name
------------------------------------
update_routes_updated_at
update_route_stats_after_point_change
```

---

## 🎯 Paso 6: Probar que Funciona

### Insertar una Ruta de Prueba

```sql
-- Insertar ruta de prueba
INSERT INTO public.routes (
  name,
  description,
  difficulty,
  start_lat,
  start_lng,
  end_lat,
  end_lng,
  created_by,
  is_public,
  status
) VALUES (
  'Ruta de Prueba',
  'Esta es una ruta de prueba',
  'Intermediate',
  -13.5319,
  -71.9675,
  -13.5200,
  -71.9600,
  auth.uid(), -- Tu usuario actual
  true,
  'active'
);
```

### Verificar Ruta Insertada

```sql
-- Ver rutas creadas
SELECT id, name, difficulty, created_at 
FROM public.routes 
ORDER BY created_at DESC 
LIMIT 5;
```

---

## ❌ Solución de Problemas

### Error: "permission denied for schema public"

**Solución:**
```sql
-- Ejecuta esto primero para dar permisos
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO anon;
GRANT ALL ON SCHEMA public TO authenticated;
```

### Error: "relation already exists"

**Significa:** Las tablas ya existen

**Solución:** Si quieres reiniciar desde cero:
```sql
-- Eliminar tablas existentes (CUIDADO: borra todos los datos)
DROP TABLE IF EXISTS public.route_track_points CASCADE;
DROP TABLE IF EXISTS public.routes CASCADE;
DROP FUNCTION IF EXISTS public.get_route_with_points CASCADE;
DROP FUNCTION IF EXISTS public.calculate_distance_meters CASCADE;
DROP FUNCTION IF EXISTS public.update_route_stats CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column CASCADE;

-- Luego vuelve a ejecutar el schema-routes.sql completo
```

### Error: "function gen_random_uuid() does not exist"

**Solución:**
```sql
-- Habilitar extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

---

## 🔗 Variables de Entorno

Después de crear las tablas, asegúrate de tener las variables en `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Cómo Obtener las Variables

1. En Supabase Dashboard
2. Ve a **"Settings"** (engranaje en menú lateral)
3. Click en **"API"**
4. Copia:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## ✅ Checklist Final

- [ ] Abriste Supabase Dashboard
- [ ] Fuiste a SQL Editor
- [ ] Copiaste el schema-routes.sql completo
- [ ] Ejecutaste el SQL
- [ ] Apareció "Success"
- [ ] Verificaste las tablas creadas
- [ ] Verificaste las funciones
- [ ] Verificaste los triggers
- [ ] Tienes las variables de entorno en `.env.local`

---

## 🎯 Después de Configurar

Una vez configurada la base de datos:

1. **Reinicia tu app** en desarrollo:
   ```bash
   npm run dev
   ```

2. **Prueba crear una ruta:**
   - Ve a `/dashboard/profile`
   - Click en el botón `+` verde
   - Dibuja una ruta en el mapa
   - Completa la información
   - Click en "Guardar Ruta"

3. **Verifica que se guardó:**
   - Debería redirigirte al perfil
   - La ruta debería aparecer en la lista

---

## 📞 Soporte

Si tienes problemas:

1. **Revisa la consola del navegador** (F12)
2. **Revisa los logs de Supabase:**
   - Dashboard → Database → Logs
3. **Verifica que las tablas existen:**
   - Dashboard → Table Editor → Deberías ver `routes` y `route_track_points`

---

## 🎉 ¡Listo!

Una vez que veas las tablas creadas, tu app podrá:
- ✅ Crear rutas nuevas
- ✅ Guardar puntos GPS
- ✅ Calcular distancia automáticamente
- ✅ Calcular elevación automáticamente
- ✅ Mostrar tus rutas en el perfil

---

**¡No olvides ejecutar el schema-routes.sql en Supabase!** 🗄️✨
