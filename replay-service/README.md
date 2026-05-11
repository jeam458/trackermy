# Replay processor (servidor)

Procesamiento **opcional** para reconstrucción / replay 3D a partir del vídeo guardado en `route_attempts.video_url`.

## Qué hace hoy

1. Valida el **access token** de Supabase del usuario.
2. Comprueba que el **intento** (`route_attempts.id`) es suyo.
3. Exige que exista `video_url`.
4. Escribe progreso y resultado en **`replay_3d_meta`** (JSONB).

El resultado actual es un **stub**: sirve para cablear la app, despliegue y permisos. Sustituye el bloque marcado en `main.py` por tu pipeline (p. ej. inferencia LingBot cuando tengas el código y pesos en este mismo contenedor o en un worker GPU).

### Contrato `replay_3d_meta` (lo lee la app)

| Campo | Uso |
|--------|-----|
| `status` | `"processing"` mientras trabajas; `"ready"` al terminar bien; `"failed"` si falla. |
| `engine` | Identificador del pipeline (p. ej. `lingbot-map-v1`). |
| `message` | Texto opcional para la UI (progreso, fase). |
| `error` | Si `failed`, mensaje para el usuario. |
| `result` | Objeto con URLs a malla/tiles/etc. cuando integres LingBot de verdad. |

La app **hace polling** en Supabase cada ~3,5 s mientras `status === "processing"`, así no hace falta otro endpoint solo para consultar estado.

## LingBot-Map (reconstrucción 3D desde vídeo)

El modelo que encaja con “procesar mis vídeos de recorrido” es **[LingBot-Map](https://github.com/Robbyant/lingbot-map)** (Apache-2.0): modelo feed-forward para **reconstrucción 3D en streaming** a partir de secuencias de imágenes / vídeo. No está embebido en esta app; corre en un **worker con GPU**.

### Qué pide el proyecto oficial

Según el [README del repo](https://github.com/Robbyant/lingbot-map/blob/main/README.md):

- Python 3.10, **PyTorch con CUDA** (ej. CUDA 12.8 en sus instrucciones).
- Instalación: `pip install -e .` dentro del clon del repo; opcional **FlashInfer** para KV cache más eficiente.
- **Pesos**: descargar checkpoint (p. ej. `lingbot-map-long`) desde [Hugging Face `robbyant/lingbot-map`](https://huggingface.co/robbyant/lingbot-map) (mejor para secuencias largas / escenas grandes).
- **Vídeo**: el demo soporta `--video_path` y, para vídeos largos, **`--mode windowed --window_size 128`** (y `--fps` para muestrear frames).

Ejemplo orientativo (tras tener el `.pt` local):

```bash
python demo.py --model_path /path/to/lingbot-map-long.pt \
  --video_path /tmp/attempt.mp4 --fps 10 \
  --mode windowed --window_size 128
```

`demo.py` por defecto levanta un visor **viser** en un puerto (útil en desarrollo). En **producción** necesitarás o bien un modo sin UI (revisar el paquete `lingbot_map` y el flujo interno del demo) o ejecutar inferencia en subproceso y **solo serializar la salida** (nube de puntos / mesh / lo que expongan) sin abrir el navegador.

### Cómo encaja con *este* `replay-service`

Flujo recomendado (mismo contrato que ya usa la app):

1. **`POST /process`** con `attempt_id` (ya implementado): validar usuario, obtener `video_url`, descargar el archivo a un temporal.
2. Marcar `replay_3d_meta.status = "processing"` y `message` con fase (descarga / inferencia / subida).
3. **Invocar LingBot-Map** sobre ese vídeo (subproceso o import del código clonado en la misma imagen Docker GPU).
4. **Subir artefactos** a un bucket de Supabase Storage (ej. `replay-3d` o el que definas): PLY, GLB, tiles, etc.
5. **`PATCH` de `replay_3d_meta`** con `status: "ready"`, `engine: "lingbot-map-…"`, y en `result` las **URLs públicas** (o paths firmados) + metadatos mínimos (fps usado, ventana, versión del checkpoint).

Para trabajos **largos** (minutos de vídeo), no bloquees el request HTTP hasta el final: usa **cola + worker en background** (Celery/RQ/tarea async + otro proceso) y deja el cliente haciendo **polling** de `replay_3d_meta` (la app ya lo hace).

### Imagen Docker

El `Dockerfile` actual es **slim sin GPU** (solo stub FastAPI). Para LingBot-Map necesitas una imagen base **NVIDIA CUDA** + PyTorch + dependencias del repo; suele ser un **segundo Dockerfile** (p. ej. `Dockerfile.lingbot`) o un repositorio de despliegue aparte que exponga el mismo `/process` o una cola.

### Otros enlaces Robbyant

- <https://github.com/robbyant/lingbot-world>
- <https://www.lingbot-world.com/>

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `SUPABASE_URL` | URL del proyecto (https://xxx.supabase.co) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Solo en el servidor**, nunca en el cliente |
| `SUPABASE_JWT_SECRET` | JWT Secret del proyecto (Settings → API) |
| `CORS_ORIGINS` | Opcional, coma-separado; por defecto `*` |
| `PORT` | Puerto (Railway/Fly suelen inyectarlo) |

## Ejecutar en local

```bash
cd replay-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export SUPABASE_URL=...
export SUPABASE_SERVICE_ROLE_KEY=...
export SUPABASE_JWT_SECRET=...
uvicorn main:app --reload --port 8080
```

## Despliegue

Cualquier plataforma con Docker: Fly.io, Railway, Google Cloud Run, etc. Para LingBot real probablemente necesites **GPU** (instancia dedicada o modal.com / similar).

## App móvil (Capacitor)

En el cliente, configura `NEXT_PUBLIC_REPLAY_SERVICE_URL=https://tu-servidor/process` — la app hace `POST /process` con el JWT del usuario. Sin URL pública, el botón de procesar no llama al servidor.

Para **solo nativo** sin servidor: implementa un plugin Capacitor que ejecute ONNX/TFLite y actualice `replay_3d_meta` vía Supabase client con el usuario ya autenticado.
