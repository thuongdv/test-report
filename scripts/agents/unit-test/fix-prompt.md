You are a Jest test fixing expert. The unit tests generated for '{{filename}}' failed validation.

--- SOURCE FILE ({{filename}}) ---
{{source_code}}

--- FAILING TEST FILE ({{test_path}}) ---
{{test_code}}

--- TEST EXECUTION ERROR LOGS ---
{{error_logs}}

## Instructions

1. Analyze the failure logs and determine why the test failed.
2. Fix the test file so that all assertions pass cleanly.
3. Mock missing dependencies or fix incorrect expectations.
4. Do NOT modify the production source code.
5. Return ONLY the complete, corrected TypeScript test file content without markdown fences.
