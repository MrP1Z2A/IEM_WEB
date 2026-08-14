import { QuizQuestion } from "../types";

const splitIntoSentences = (content: string): string[] => {
  return content
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);
};

const extractKeywords = (content: string): string[] => {
  const stopWords = new Set([
    'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'your', 'have', 'has', 'are', 'was', 'were',
    'will', 'been', 'their', 'about', 'what', 'when', 'where', 'which', 'while', 'would', 'could', 'should',
    'there', 'than', 'then', 'them', 'they', 'you', 'our', 'his', 'her', 'its', 'not', 'can', 'use', 'used',
    'also', 'more', 'most', 'some', 'such', 'any', 'all', 'each', 'other', 'many', 'much', 'over', 'under'
  ]);

  const counts = content
    .toLowerCase()
    .match(/[a-z][a-z0-9-]{2,}/g)
    ?.filter(word => !stopWords.has(word))
    .reduce<Record<string, number>>((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {}) || {};

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([word]) => word);
};

export const summarizeNotes = async (content: string): Promise<string> => {
  if (!content.trim()) return 'No notes available to summarize.';

  const sentences = splitIntoSentences(content);
  const topSentences = sentences.slice(0, 4);

  if (topSentences.length === 0) {
    return 'Summary unavailable.';
  }

  return topSentences.map(sentence => `• ${sentence}`).join('\n');
};

export const generateQuizFromNotes = async (content: string): Promise<QuizQuestion[]> => {
  if (!content.trim()) return [];

  const keywords = extractKeywords(content);
  if (keywords.length < 5) return [];

  const paddedKeywords = [...keywords];
  while (paddedKeywords.length < 8) {
    paddedKeywords.push(`concept-${paddedKeywords.length + 1}`);
  }

  const makeOptions = (correct: string, pool: string[]): string[] => {
    const distractors = pool.filter(word => word !== correct).slice(0, 3);
    while (distractors.length < 3) {
      distractors.push(`option-${distractors.length + 1}`);
    }
    return [correct, ...distractors];
  };

  return paddedKeywords.slice(0, 5).map((topic, index) => {
    const optionPool = [...paddedKeywords.slice(index + 1), ...paddedKeywords.slice(0, index)];
    return {
      question: `Which term is most central to this note set? (${index + 1})`,
      options: makeOptions(topic, optionPool),
      correctAnswer: 0
    };
  });
};

export const askTutor = async (question: string, context: string): Promise<string> => {
  const cleanQuestion = question.trim();
  const summary = await summarizeNotes(context);

  if (!cleanQuestion) {
    return 'Please enter a question.';
  }

  if (!context.trim()) {
    return `Question received: "${cleanQuestion}". Add course notes to get a context-based answer.`;
  }

  return `Based on your notes, here are key points to review:\n${summary}`;
};
