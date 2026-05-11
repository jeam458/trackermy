---
name: test-driven-development
description: >-
  Desarrollo guiado por tests: escribir tests primero, implementar el mínimo
  código para pasarlos y refactorizar con seguridad. Usar para lógica crítica o
  regresiones frecuentes.
---

# Test-driven development (TDD)

## Ciclo

1. Escribir un test que falle por la razón correcta (fallo observable).
2. Implementar lo mínimo para que pase.
3. Refactorizar sin cambiar el comportamiento; los tests siguen en verde.

## Buenas prácticas

- Tests pequeños, con nombres que describan comportamiento, no implementación.
- Aislar dependencias externas con mocks/fakes solo donde aporte valor.
