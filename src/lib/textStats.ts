export interface TextStats {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  sentences: number;
  paragraphs: number;
  readingMinutes: number;
}

const WORDS_PER_MINUTE = 230;

export function textStats(text: string): TextStats {
  const trimmed = text.trim();
  if (trimmed === "") {
    return { words: 0, characters: 0, charactersNoSpaces: 0, sentences: 0, paragraphs: 0, readingMinutes: 0 };
  }
  const words = trimmed.split(/\s+/).length;
  const characters = Array.from(text).length;
  const charactersNoSpaces = Array.from(text.replace(/\s/g, "")).length;
  const sentences = (trimmed.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? []).filter((s) => s.trim()).length;
  const paragraphs = trimmed.split(/\n\s*\n/).filter((p) => p.trim()).length;
  return { words, characters, charactersNoSpaces, sentences, paragraphs, readingMinutes: words / WORDS_PER_MINUTE };
}
