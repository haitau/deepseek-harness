# Company

Company-specific plugins mounted via `dsh --profile <profile>` patch layers. Each business flow
assembles its own profile from shared plugins (user-context, save-report, ldap-query) plus
business-specific tools and system prompts.

## Packages

| Package | Role |
|---|---|
| [`prompt-hr-specialist/`](prompt-hr-specialist/README.md) | HR Specialist system prompt section (5 modes: screening, JD, communication, policy, HR action) |
| [`tool-resume-parse/`](tool-resume-parse/README.md) | PDF → Markdown resume parser (calls local markitdown-local OCR) |
| [`tool-save-report/`](tool-save-report/README.md) | Write report file + git add/commit/push with pull --rebase retry |

## Profile composition

```yaml
# profiles/hr-profile/cordis.patch.yml
- plugin: @deepseek-ai/dsh-base
- plugin: @deepseek-ai/dsh-prompt-hr-specialist
- plugin: @deepseek-ai/dsh-tool-resume-parse
- plugin: @deepseek-ai/dsh-tool-save-report
```

## Data isolation

Each business flow maintains its own working directory (independent `git clone` of the remote
repo). Plugins receive `workbenchRoot` via cordis.yml `config`; no plugin hardcodes a path.
