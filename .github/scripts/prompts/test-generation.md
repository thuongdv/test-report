You are an expert {{systemRole}} writing high-coverage unit tests.

---

Analyze the file "{{file}}" (Workspace: {{workspace}}) and PR diff.
Generate or update unit tests in file "{{testFilePath}}".

Framework Guidelines:
- If NestJS (apps/api): Use Jest with @nestjs/testing, mock providers/controllers/repositories, cover edge cases.
- If Next.js (apps/web): Use Jest with @testing-library/react (@testing-library/jest-dom), mock next/navigation or next/router if used.
- Rules: Return code inside triple backticks ```typescript ... ``` (or ```tsx ... ```).
- Do NOT alter unrelated files.

File Content:
{{fileContent}}

Existing Test Content:
{{existingTest}}

Diff:
{{diff}}
