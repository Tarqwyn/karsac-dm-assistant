import { mkdirSync, writeFileSync, existsSync } from 'fs'
import { resolve, relative } from 'path'
import matter from 'gray-matter'
import { slugify } from './slugify.js'
import type { ProposalType, ProposalFrontmatter } from './proposalTypes.js'
import { PROPOSAL_FOLDERS } from './proposalTypes.js'

export interface WriteResult {
  path: string
  slug: string
  existed: boolean
}

function yamlStringify(obj: Record<string, unknown>): string {
  // Simple recursive YAML serializer sufficient for flat/nested frontmatter
  function serializeValue(val: unknown, indent = 0): string {
    const pad = '  '.repeat(indent)
    if (val === null || val === undefined) return 'null'
    if (typeof val === 'boolean') return val ? 'true' : 'false'
    if (typeof val === 'number') return String(val)
    if (typeof val === 'string') {
      // Multi-line strings
      if (val.includes('\n')) {
        const lines = val.split('\n').map(l => `${pad}  ${l}`).join('\n')
        return `|-\n${lines}`
      }
      // Strings needing quoting
      if (/[:#\[\]{}&*!|>'"%@`]/.test(val) || val.trim() !== val || val === '' || /^(true|false|null|yes|no)$/i.test(val)) {
        return `'${val.replace(/'/g, "''")}'`
      }
      return val
    }
    if (Array.isArray(val)) {
      if (val.length === 0) return '[]'
      return '\n' + val.map(item => `${pad}- ${serializeValue(item, indent)}`).join('\n')
    }
    if (typeof val === 'object') {
      const entries = Object.entries(val as Record<string, unknown>)
      if (entries.length === 0) return '{}'
      return '\n' + entries.map(([k, v]) => {
        const serialized = serializeValue(v, indent + 1)
        if (serialized.startsWith('\n')) {
          return `${pad}  ${k}:${serialized}`
        }
        return `${pad}  ${k}: ${serialized}`
      }).join('\n')
    }
    return String(val)
  }

  const lines: string[] = []
  for (const [key, val] of Object.entries(obj)) {
    const serialized = serializeValue(val, 0)
    if (serialized.startsWith('\n')) {
      lines.push(`${key}:${serialized}`)
    } else {
      lines.push(`${key}: ${serialized}`)
    }
  }
  return lines.join('\n')
}

export function writeProposal(
  proposalsRoot: string,
  proposalType: ProposalType,
  title: string,
  frontmatter: ProposalFrontmatter,
  body: string,
): WriteResult {
  const subfolder = PROPOSAL_FOLDERS[proposalType]
  const dir = resolve(proposalsRoot, subfolder)

  // Safety check — ensure output is under proposalsRoot
  const relDir = relative(proposalsRoot, dir)
  if (relDir.startsWith('..') || resolve(dir) !== resolve(proposalsRoot, relDir)) {
    throw new Error(`Path escape detected: ${dir} is outside ${proposalsRoot}`)
  }

  mkdirSync(dir, { recursive: true })

  const baseSlug = slugify(title)
  let slug = baseSlug
  let existed = false
  let suffix = 2

  while (existsSync(resolve(dir, `${slug}.proposed.md`))) {
    existed = true
    slug = `${baseSlug}-${suffix}`
    suffix++
  }

  const filePath = resolve(dir, `${slug}.proposed.md`)

  // Final safety check on output path
  const relPath = relative(proposalsRoot, filePath)
  if (relPath.startsWith('..')) {
    throw new Error(`Path escape detected: output file ${filePath} is outside ${proposalsRoot}`)
  }

  const fm = frontmatter as unknown as Record<string, unknown>
  const yamlBlock = yamlStringify(fm)
  const content = `---\n${yamlBlock}\n---\n\n${body}\n`

  writeFileSync(filePath, content, { encoding: 'utf-8' })

  return { path: filePath, slug, existed }
}
