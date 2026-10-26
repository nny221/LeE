export function normalizeTerm(term: string): string {
  return term.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US')
}
