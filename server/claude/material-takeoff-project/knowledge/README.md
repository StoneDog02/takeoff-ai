# Knowledge / reference files

Drop your reference files here (e.g. specs, unit conventions, trade lists). They are loaded at runtime and included in the system prompt so Claude has the same context as your custom project.

**Supported formats:**

- **Text:** `.txt`, `.md`, `.csv`, `.json`, `.py` — read as-is.
- **PDF:** `.pdf` — text is extracted and included.
- **Excel:** `.xlsx`, `.xls` — each sheet is converted to CSV-style text.
- **Word:** `.docx` — text is extracted and included.

Files are processed in alphabetical order. Unsupported file types are skipped (see server logs for any errors).
