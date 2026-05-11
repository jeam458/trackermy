"""
Servicio opcional de post-procesado para replay 3D / reconstrucción a partir del vídeo del intento.

- Valida el JWT del usuario de Supabase y comprueba que el intento le pertenece.
- Lee video_url (y/o medios) del intento.
- Por ahora escribe un resultado STUB en route_attempts.replay_3d_meta.

Cuando tengas LingBot-Map (u otro modelo) en este mismo entorno:
  1. Descarga vídeo desde video_url o Signed URL.
  2. Ejecuta inferencia frame a frame (GPU recomendada).
  3. Serializa poses / malla / tiles en Storage y guarda URLs + metadatos en replay_3d_meta.

Documentación proyectos oficiales Robbyant (licencia y pesos): ver README en esta carpeta.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

import httpx
import jwt
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
# Mismo "JWT Secret" que en Supabase Dashboard → Settings → API → JWT Settings
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")

app = FastAPI(title="Downhill Tracker — replay processor", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ProcessRequest(BaseModel):
    attempt_id: str


def _sb_headers(service: bool = True) -> dict[str, str]:
    key = SUPABASE_SERVICE_ROLE_KEY if service else ""
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }


def decode_user_id(bearer: str) -> str:
    if not SUPABASE_JWT_SECRET:
        raise HTTPException(500, "SUPABASE_JWT_SECRET no configurado en el worker")
    token = bearer.removeprefix("Bearer ").strip()
    try:
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.PyJWTError as e:
        raise HTTPException(401, f"Token inválido: {e}") from e
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(401, "Token sin sub")
    return str(sub)


async def first_video_from_media(attempt_id: str) -> str | None:
    url = f"{SUPABASE_URL}/rest/v1/route_attempt_media"
    params = {
        "attempt_id": f"eq.{attempt_id}",
        "kind": "eq.video",
        "select": "public_url",
        "limit": "1",
    }
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(url, params=params, headers=_sb_headers())
        if r.status_code != 200:
            return None
        rows = r.json()
        if rows:
            return str(rows[0].get("public_url") or "") or None
    return None


async def fetch_attempt(attempt_id: str) -> dict[str, Any]:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(500, "SUPABASE_URL o SERVICE_ROLE no configurados")
    url = f"{SUPABASE_URL}/rest/v1/route_attempts"
    params = {"id": f"eq.{attempt_id}", "select": "*"}
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.get(url, params=params, headers=_sb_headers())
        if r.status_code != 200:
            raise HTTPException(502, f"Supabase GET attempt: {r.status_code} {r.text}")
        rows = r.json()
        if not rows:
            raise HTTPException(404, "Intento no encontrado")
        return rows[0]


async def patch_attempt_meta(attempt_id: str, meta: dict[str, Any]) -> None:
    url = f"{SUPABASE_URL}/rest/v1/route_attempts"
    params = {"id": f"eq.{attempt_id}"}
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.patch(
            url,
            params=params,
            headers=_sb_headers(),
            json={"replay_3d_meta": meta},
        )
        if r.status_code not in (200, 204):
            raise HTTPException(502, f"Supabase PATCH attempt: {r.status_code} {r.text}")


@app.get("/health")
async def health():
    return {"ok": True, "service": "replay-processor"}


@app.post("/process")
async def process_run(
    body: ProcessRequest,
    authorization: str | None = Header(default=None),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Authorization: Bearer <supabase_access_token>")

    user_id = decode_user_id(authorization)
    attempt = await fetch_attempt(body.attempt_id)

    if str(attempt.get("user_id")) != user_id:
        raise HTTPException(403, "Este intento no pertenece al usuario autenticado")

    video_url = attempt.get("video_url")
    if not video_url:
        video_url = await first_video_from_media(body.attempt_id)
    if not video_url:
        raise HTTPException(
            400,
            "No hay vídeo: guarda video_url en el intento o sube un vídeo en la galería del intento.",
        )

    processing: dict[str, Any] = {
        "status": "processing",
        "engine": "stub-server-v1",
        "requested_at": datetime.now(timezone.utc).isoformat(),
        "video_url": video_url,
        "message": "Procesamiento simulado. Integra aquí LingBot-Map / tu pipeline de visión.",
    }
    await patch_attempt_meta(body.attempt_id, processing)

    # --- Aquí iría: descargar vídeo, ejecutar LingBot-Map, subir resultado a Storage ---
    # result_mesh_url = run_lingbot_map(video_path)
    ready: dict[str, Any] = {
        "status": "ready",
        "engine": "stub-server-v1",
        "processed_at": datetime.now(timezone.utc).isoformat(),
        "video_url": video_url,
        "result": {
            "kind": "stub",
            "detail": "Sin malla 3D aún. Sustituye este bloque por salida real del modelo.",
        },
        "native_fallback_hint": "En móvil puedes usar un plugin Capacitor + ONNX/TFLite si cuantizas el modelo.",
    }
    await patch_attempt_meta(body.attempt_id, ready)
    return {"ok": True, "attempt_id": body.attempt_id, "replay_3d_meta": ready}
