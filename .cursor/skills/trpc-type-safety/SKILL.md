---
name: trpc-type-safety
description: >-
  End-to-end type safety con tRPC: routers, procedimientos, validación de
  entrada/salida y contratos cliente-servidor. Usar al definir o consumir APIs
  en TypeScript.
---

# tRPC type safety

## Instrucciones

1. Definir esquemas de entrada/salida explícitos (p. ej. Zod) en los procedures.
2. Exportar tipos inferidos del router para el cliente; evitar duplicar DTOs a mano.
3. Mantener procedures enfocados; extraer lógica compartida en utilidades tipadas.
4. Documentar errores esperados y códigos HTTP/estado cuando aplique.
