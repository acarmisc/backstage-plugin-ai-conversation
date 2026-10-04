
/**
 * Generic starter prompts when no skill is selected.
 * These are designed to be general-purpose conversation starters.
 */
const GENERIC_PROMPTS = [
  'Summarize the key points of our onboarding docs',
  'Explain this error message and how to fix it',
  'Draft a short status update for my team',
  'Compare two approaches and list trade-offs',
];

/**
 * Get starter prompt suggestions for the composer.
 * When a skill is provided, returns skill-flavored suggestions.
 * Otherwise, returns generic prompts.
 *
 * @param skill - Optional skill metadata with title and tags
 * @returns Array of 4 starter prompt suggestions
 */
export function getStarterPrompts(skill?: { title: string; tags?: string[] } | null): string[] {
  if (!skill) {
    return GENERIC_PROMPTS;
  }

  // Build skill-flavored prompts using the skill title
  const skillTitle = skill.title;
  return [
    `Ask ${skillTitle}: What are the most important things I should know?`,
    `According to ${skillTitle}, what's the best approach for this?`,
    `What insights can ${skillTitle} provide about this topic?`,
    `Help me understand this from ${skillTitle}'s perspective`,
  ];
}
