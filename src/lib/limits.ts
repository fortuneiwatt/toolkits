/** Hard caps so a huge paste can't freeze the tab. Tools must check these before processing. */
export const MAX_TEXT_CHARS = 2_000_000;

export function exceedsLimit(input: string, max = MAX_TEXT_CHARS): boolean {
  return input.length > max;
}

export const limitMessage = (max = MAX_TEXT_CHARS) =>
  `Input is too large (limit ${max.toLocaleString("en-US")} characters). Split it into smaller parts.`;
