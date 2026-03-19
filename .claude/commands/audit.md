Code review for a specific file, directory, or feature area. Checks for type safety, permission enforcement, tenant scoping, test coverage, and convention compliance.

## Usage
`/audit [file-or-area]` — e.g., `/audit packages/backend/src/routes/jobs/`, `/audit pricing-engine`, `/audit packages/shared/src/schemas/`

## Steps

### 1. Identify Scope
- If a file path is given, audit that file and its related files (test file, shared schemas it uses, routes that reference it)
- If an area name is given (e.g., "pricing", "jobs"), find all relevant files across packages
- If no argument, audit the most recently changed files (`git diff --name-only HEAD~5`)

### 2. Type Safety Audit
For every file in scope, check:
- [ ] No `any` types (not as type, cast, generic parameter, or "temporary")
- [ ] No `as` type assertions (fix the actual type instead)
- [ ] No `@ts-ignore` or `@ts-expect-error`
- [ ] No `!` non-null assertions (handle the null case)
- [ ] No `// eslint-disable` for type-related rules
- [ ] Every exported function has explicit return type
- [ ] Generic types are constrained (`<T extends SomeType>` not `<T>`)
- [ ] Types derived from Zod schemas via `z.infer<>`, not defined separately

### 3. Permission & Security Audit
For every API route handler in scope:
- [ ] Calls a permission check function before business logic
- [ ] Is tenant-scoped via middleware (not manual WHERE clause)
- [ ] Has Zod validation on all inputs
- [ ] Returns consistent error format `{ error, code, details }`
- [ ] Creates audit log entry for write operations
- [ ] Does not log sensitive data (passwords, API keys, health info)
- [ ] File uploads validated (type, size) if applicable

### 4. Test Coverage Audit
- [ ] Business logic functions have unit tests
- [ ] API routes have at least one happy-path and one error-path integration test
- [ ] Money calculations, permission checks, and compliance logic have tests
- [ ] External services mocked at HTTP boundary (not database)
- [ ] Test file co-located: `foo.ts` → `foo.test.ts`

### 5. Convention Compliance
- [ ] Files: kebab-case | Components: PascalCase | Functions: camelCase
- [ ] DB tables/columns: snake_case | API endpoints: kebab-case
- [ ] All tables have `id` (UUID), `created_at`, `updated_at`, `deleted_at`
- [ ] Soft deletes only (no hard deletes)
- [ ] Australian formatting (DD/MM/YYYY in UI, E.164 phone, ABN validation)
- [ ] Imports use path aliases (`@frontend/`, `@backend/`, `@shared/`)
- [ ] Shared types/schemas in `@shared/`, not duplicated across packages

### 6. Report
Present findings grouped by severity:
- **Critical** — Type safety violations, missing permission checks, missing tenant scoping
- **Warning** — Missing tests, convention violations, incomplete error handling
- **Info** — Suggestions for improvement, patterns that could be cleaner

For each finding, include: file path, line number, what's wrong, and how to fix it.
