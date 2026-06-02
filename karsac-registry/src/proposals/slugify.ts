/**
 * Convert arbitrary text to a URL-safe slug.
 * - Lowercase
 * - Strip non-alphanumeric (keep hyphens and spaces)
 * - Collapse spaces to hyphens
 * - Trim to 60 chars
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}
