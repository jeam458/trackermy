# Supabase DB (fuente canónica)

La fuente oficial del esquema es:

- `supabase/migrations/*.sql` (orden numérico)

No usar `schema-*.sql` para provisioning de entornos nuevos; esos archivos son legacy/manual y pueden causar drift.

## Aplicar esquema

```bash
supabase db push
```

## Ver estado de migraciones

```bash
supabase migration list
```

## Nota de compatibilidad

Se añadió `016_reconcile_legacy_schema_files.sql` para absorber diferencias históricas de proyectos que ejecutaron scripts legacy en SQL Editor.
