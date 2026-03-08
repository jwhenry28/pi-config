---
name: skill-manager
description: Use when writing or reviewing pi skills - covers formatting, structure, progressive disclosure, and authoring best practices
module: general
---

# Writing Effective Skills

Best practices for authoring skills that are concise, well-structured, and easy for agents to use.

## Core Principle

**Claude is already smart. Only add context it doesn't already have.**

Challenge every piece of content:

- "Does Claude really need this explanation?"
- "Can I assume Claude knows this?"
- "Does this paragraph justify its token cost?"

## SKILL.md Structure

### Frontmatter

Every skill needs YAML frontmatter with `name` and `description`:

```yaml
---
name: my-skill-name
description: Use when [specific triggers] - [what the skill does]
---
```

**Naming:** Use gerund form (verb + -ing): "Processing PDFs", "Analyzing spreadsheets", "Managing databases"

**Description rules:**
- Write in third person ("Processes Excel files", not "I help you process")
- Be specific and include trigger terms for discovery
- Include both what it does AND when to use it

**Good descriptions:**
```yaml
description: Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction.
```

**Bad descriptions:**
```yaml
description: Helps with documents
description: Does stuff with files
```

### Body Size

- Keep SKILL.md under **500 lines**
- Target **1,000–2,000 words** for reasoning skills
- Target **200–600 words** for simple utility/wrapper skills
- If it's getting long, extract to `references/`

## Progressive Disclosure

**Don't load everything upfront.** SKILL.md is a lean overview that points to detailed content loaded on demand.

### Directory Structure

```
skill-name/
├── SKILL.md              # Lean core (loaded when skill triggers)
├── references/           # Detailed docs (loaded on demand)
│   ├── api-reference.md
│   └── advanced-patterns.md
├── examples/             # Real-world demos (loaded on demand)
│   └── case-study.md
└── templates/            # Copy-paste starters (loaded on demand)
    └── starter-template.md
```

### What Goes Where

| Content Type | Location | Example |
| --- | --- | --- |
| Overview, workflow, quick reference | `SKILL.md` | Core steps, when-to-use |
| Detailed explanations (>200 words) | `references/` | API schemas, advanced patterns |
| Complete working examples | `examples/` | Before/after, case studies |
| Copy-paste boilerplate | `templates/` | Starter files, config templates |

### Linking to References

Use markdown links — Claude reads them on demand:

```markdown
## Advanced Features

For complete schema, see [references/api-schema.md](references/api-schema.md).
For real-world usage, see [examples/case-study.md](examples/case-study.md).
```

**Don't force-load:** Let Claude decide when it needs the detail.

### Keep References One Level Deep

All reference files should link **directly from SKILL.md**. Don't nest references inside references — Claude may only partially read deeply nested files.

```markdown
# ❌ BAD: Nested references
SKILL.md → advanced.md → details.md → actual info

# ✅ GOOD: One level deep
SKILL.md → advanced.md
SKILL.md → details.md
SKILL.md → reference.md
```

### Table of Contents for Long References

For reference files over 100 lines, put a table of contents at the top so Claude can see the full scope even with a partial read.

## Writing Style

### Be Concise

**Good** (~50 tokens):
````markdown
## Extract PDF text

Use pdfplumber for text extraction:

```python
import pdfplumber
with pdfplumber.open("file.pdf") as pdf:
    text = pdf.pages[0].extract_text()
```
````

**Bad** (~150 tokens):
```markdown
## Extract PDF text

PDF (Portable Document Format) files are a common file format that contains
text, images, and other content. To extract text from a PDF, you'll need to
use a library. There are many libraries available for PDF processing, but we
recommend pdfplumber because it's easy to use...
```

### Use Consistent Terminology

Pick one term and stick with it:

- ✅ Always "API endpoint" — not mixing "URL", "API route", "path"
- ✅ Always "field" — not mixing "box", "element", "control"
- ✅ Always "extract" — not mixing "pull", "get", "retrieve"

### Avoid Time-Sensitive Information

```markdown
# ❌ BAD
If you're doing this before August 2025, use the old API.

# ✅ GOOD
## Current method
Use the v2 API endpoint: `api.example.com/v2/messages`
```

### Don't Offer Too Many Options

```markdown
# ❌ BAD: Too many choices
You can use pypdf, or pdfplumber, or PyMuPDF, or pdf2image, or...

# ✅ GOOD: Provide a default with escape hatch
Use pdfplumber for text extraction.
For scanned PDFs requiring OCR, use pdf2image with pytesseract instead.
```

## Degrees of Freedom

Match specificity to the task's fragility:

**High freedom** (multiple valid approaches):
```markdown
## Code review process
1. Analyze code structure
2. Check for potential bugs
3. Suggest improvements
4. Verify project conventions
```

**Low freedom** (fragile, must be exact):
```markdown
## Database migration
Run exactly this script:
$ python scripts/migrate.py --verify --backup
Do not modify the command or add additional flags.
```

**Analogy:** Narrow bridge with cliffs → exact instructions. Open field → general direction.

## Formatting Standards

### Tables

- Always include header separator row (`| --- | --- |`)
- Keep consistent column counts across rows

### Code Blocks

- Always use language tags: ` ```bash ` not ` ``` `
- Match content to tag (bash commands → `bash`, TypeScript → `typescript`)
- Keep lines under 120 characters

### Headers

- Single `# Title` at top (one H1 per file)
- Don't skip levels (H1 → H2 → H3, never H1 → H3)
- Every header should have content before the next header

## Workflows and Feedback Loops

For complex multi-step tasks, provide a checklist:

````markdown
## Deployment workflow

```
Task Progress:
- [ ] Step 1: Run tests
- [ ] Step 2: Build artifacts
- [ ] Step 3: Deploy to staging
- [ ] Step 4: Verify staging
- [ ] Step 5: Deploy to production
```
````

For quality-critical tasks, include validation loops:

```markdown
1. Make edits
2. Run validator
3. If validation fails → fix and re-run
4. Only proceed when validation passes
```

## Checklist

Before considering a skill complete:

- [ ] Description is specific with trigger terms
- [ ] SKILL.md is under 500 lines
- [ ] Detailed content extracted to `references/`
- [ ] No time-sensitive information
- [ ] Consistent terminology throughout
- [ ] Code blocks have language tags
- [ ] Tables have proper separators
- [ ] References are one level deep from SKILL.md
- [ ] Concise — no explanations Claude doesn't need
