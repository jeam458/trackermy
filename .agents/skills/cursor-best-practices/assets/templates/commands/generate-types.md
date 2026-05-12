Generate TypeScript types or type definitions from schemas, APIs, or data structures.

## Steps

1. **Identify source**
   - Check if I @-mentioned a file (OpenAPI spec, GraphQL schema, JSON schema, API response example).
   - Or identify the source from context (API endpoint, schema file, etc.).
   - Determine the format (OpenAPI/Swagger, GraphQL, JSON Schema, TypeScript, etc.).

2. **Generate types**
   - Use appropriate tool or generate manually:
     - **OpenAPI/Swagger**: Use `openapi-typescript` or similar
     - **GraphQL**: Use `graphql-codegen` or similar
     - **JSON Schema**: Convert to TypeScript types
     - **API Response**: Infer types from example JSON
   - Generate types that match the project's style (interfaces vs types, naming conventions).

3. **Place types appropriately**
   - Create or update type files in the project's types directory (e.g. `types/`, `@types/`, `src/types/`).
   - Follow project conventions for type file organization.
   - Use appropriate file naming (e.g. `api.types.ts`, `schema.types.ts`).

4. **Update imports**
   - If types are used elsewhere, update imports.
   - Ensure type exports are correct.
   - Check for any circular dependencies.

5. **Verify types**
   - Check that generated types are valid TypeScript.
   - Ensure types match the source schema/structure.
   - Test that types work with existing code (if applicable).

6. **Report**
   - What source was used (file, API, schema)
   - Where types were generated (file path)
   - What types were created (interfaces, types, enums)
   - Any issues or warnings

## Rules

- Apply project rules from `.cursor/rules` or `AGENTS.md` when relevant (e.g. type naming, style preferences).
- Generate types that are maintainable and well-documented.
- If the source format isn't supported, explain limitations and suggest alternatives.
- For API types, consider versioning and backward compatibility.
