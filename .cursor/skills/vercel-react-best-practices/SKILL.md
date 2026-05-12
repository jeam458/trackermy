---
name: vercel-react-best-practices
description: >-
  Buenas prácticas para React en el ecosistema Vercel: App Router, rendering,
  datos, edge y despliegue. Usar al estructurar rutas, fetch y optimización.
---

# Vercel + React — buenas prácticas

## Instrucciones

1. Alinear con el modelo de rendering del framework (SSR, RSC, caché) según el caso de uso.
2. Colocar lógica de datos en capas claras; evitar mezclar fetching profundo en componentes de presentación.
3. Usar variables de entorno y configuración de build de forma explícita por entorno.
4. Medir Web Vitals cuando se toquen rutas críticas o assets pesados.
