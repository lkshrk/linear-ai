import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ISSUE_SECTIONS, type IssueError, validateIssue } from '../scripts/validate_issue'

const fixture = (name: string) => readFileSync(join(import.meta.dir, 'fixtures', 'issues', name), 'utf8')

const messages = (description: string, opts?: Parameters<typeof validateIssue>[1]) => {
  const r = validateIssue(description, opts)
  return r.ok ? [] : r.errors.map((e) => e.message)
}

function body(over: Record<string, string | null> = {}): string {
  const content: Record<string, string> = {
    Goal: 'Add a retry queue.',
    Why: 'Syncs fail on hiccups.',
    'Design excerpt': '[design](https://linear.app/x/document/d), section "Retries"',
    'Interfaces in': 'none',
    'Interfaces out': 'none',
    Files: '- src/retry.ts',
    Constraints: 'none',
    'Out of scope': 'none',
    'Acceptance criteria': '- retries 503',
    'Tests expected': '- retry.test.ts',
    Verify: '- `bun test`',
  }
  return Object.entries(content)
    .map(([heading, text]) => {
      const value = heading in over ? over[heading] : text
      return value === null ? '' : `## ${heading}\n${value}\n`
    })
    .join('\n')
}

describe('validateIssue', () => {
  test('parses a complete feature issue', () => {
    const r = validateIssue(fixture('feature.md'))
    if (!r.ok) throw new Error(r.errors.map((e) => e.message).join('\n'))
    expect(r.issue.files).toEqual([
      'packages/sync/src/retry.ts',
      'packages/sync/src/retry.test.ts',
      'packages/sync/src/client.ts',
    ])
    expect(r.issue.acceptance).toEqual(['a 503 is retried up to 5 times', 'a 400 is not retried'])
    expect(r.issue.tests).toEqual(['retry.test.ts: backoff schedule', 'retry.test.ts: non-retryable status'])
    expect(r.issue.verify).toEqual(['bun test packages/sync', 'bun run check'])
    expect(r.issue.designLinks).toEqual(['https://linear.app/h-cloud/document/sync-design-1a2b3c'])
    expect(r.issue.sections.goal).toBe(
      'Add a retry queue to the sync client so transient 5xx responses are retried with backoff.',
    )
    expect(r.issue.sections.outOfScope).toBe('')
  })

  test('accepts none as the design excerpt only when allowed', () => {
    const text = fixture('bugfix-no-design.md')
    expect(messages(text)).toEqual(["## Design excerpt: 'none' is not allowed"])
    const r = validateIssue(text, { allowNoDesign: true })
    if (!r.ok) throw new Error(r.errors.map((e) => e.message).join('\n'))
    expect(r.issue.designLinks).toEqual([])
    expect(r.issue.files).toEqual(['packages/cli/src/config.ts', 'packages/cli/src/config.test.ts'])
    expect(r.issue.acceptance).toEqual(['an empty config file gives the "no config" message'])
    expect(r.issue.verify).toEqual(['bun test packages/cli', 'bun run check'])
  })

  test('reports every section of an unfilled template as empty', () => {
    expect(messages(fixture('unfilled-template.md'))).toEqual(
      ISSUE_SECTIONS.map((s) => `## ${s.heading}: empty`),
    )
  })

  test('collects structural and content errors in one pass', () => {
    const r = validateIssue(fixture('malformed.md'))
    expect(r.ok).toBe(false)
    const errors = r.ok ? [] : r.errors
    expect(errors.map((e) => e.message)).toEqual([
      'duplicate section ## Files',
      'unknown section ## Notes',
      'missing section ## Constraints',
      "## Goal: 'none' is not allowed",
      '## Design excerpt: no link to the design document',
      "## Files: '/etc/hosts' is absolute",
      "## Files: '../shared/types.ts' leaves the repository",
      "## Files: 'see the sync package' is not a list item",
      '## Acceptance criteria: no list items',
      '## Verify: no commands (use a fenced block or one inline-code command per list item)',
    ])
    expect(errors.map((e) => e.code)).toEqual([
      'duplicate_section',
      'unknown_section',
      'missing_section',
      'none_not_allowed',
      'no_link',
      'bad_path',
      'bad_path',
      'not_list_item',
      'no_items',
      'no_commands',
    ])
    expect(errors[0]).toEqual({
      code: 'duplicate_section',
      section: 'Files',
      message: 'duplicate section ## Files',
    } satisfies IssueError)
  })

  test('reports missing sections in template order', () => {
    expect(messages(body({ Verify: null, Goal: null, Files: null }))).toEqual([
      'missing section ## Goal',
      'missing section ## Files',
      'missing section ## Verify',
    ])
  })

  test('matches headings case-insensitively and ignores hints', () => {
    const text = body()
      .replace('## Verify', '## verify (exact commands)')
      .replace('## Files', '## FILES (set)')
    expect(validateIssue(text).ok).toBe(true)
  })

  test('does not treat headings inside fenced code as sections', () => {
    const r = validateIssue(body({ Verify: '```\n## not a heading\nbun test\n```' }))
    if (!r.ok) throw new Error(r.errors.map((e) => e.message).join('\n'))
    expect(r.issue.verify).toEqual(['## not a heading', 'bun test'])
  })

  test('ignores text before the first section and other heading levels', () => {
    const text = `# Retry queue\n\nintro\n\n${body({ Goal: 'Add a queue.\n\n### Detail\nmore' })}`
    const r = validateIssue(text)
    if (!r.ok) throw new Error(r.errors.map((e) => e.message).join('\n'))
    expect(r.issue.sections.goal).toBe('Add a queue.\n\n### Detail\nmore')
  })

  test('accepts a bare URL as the design link', () => {
    const r = validateIssue(body({ 'Design excerpt': 'https://linear.app/x/document/d section Retries.' }))
    expect(r.ok && r.issue.designLinks).toEqual(['https://linear.app/x/document/d'])
  })

  test('rejects none where a section needs content', () => {
    expect(messages(body({ Why: 'None', Files: 'none', 'Tests expected': 'none.' }))).toEqual([
      "## Why: 'none' is not allowed",
      "## Files: 'none' is not allowed",
      "## Tests expected: 'none' is not allowed",
    ])
  })

  test('requires list items in files and tests', () => {
    expect(messages(body({ 'Tests expected': 'unit tests' }))).toEqual(['## Tests expected: no list items'])
  })

  test('requires verify list items to be a single inline command', () => {
    expect(messages(body({ Verify: '- run `bun test` twice' }))).toEqual([
      '## Verify: no commands (use a fenced block or one inline-code command per list item)',
    ])
  })

  test('treats a comment-only section as empty, not none', () => {
    expect(messages(body({ Constraints: '<!-- none -->' }))).toEqual(['## Constraints: empty'])
  })
})

describe('validate_issue CLI and template', () => {
  const run = (...args: string[]) =>
    Bun.spawnSync(['bun', join(import.meta.dir, '..', 'scripts', 'validate_issue.ts'), ...args], { stdout: 'pipe' })

  test('a valid issue exits 0', () => {
    const r = run(join(import.meta.dir, 'fixtures', 'issues', 'feature.md'))
    expect(r.exitCode).toBe(0)
  })

  test('an invalid issue exits 1 and prints every problem', () => {
    const r = run(join(import.meta.dir, 'fixtures', 'issues', 'malformed.md'))
    expect(r.exitCode).toBe(1)
    expect(r.stdout.toString()).toContain('duplicate section ## Files')
  })

  test('the unfilled template has every section and fails only on empty content', () => {
    const r = validateIssue(readFileSync(join(import.meta.dir, '..', 'templates', 'issue.md'), 'utf8'))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errors.every((e) => e.code === 'empty_section')).toBe(true)
    expect(r.errors.length).toBe(ISSUE_SECTIONS.length)
  })

  test('design none is allowed by default and refused with --require-design', () => {
    const file = join(import.meta.dir, 'fixtures', 'issues', 'bugfix-no-design.md')
    expect(run(file).exitCode).toBe(0)
    expect(run(file, '--require-design').exitCode).toBe(1)
  })
})
