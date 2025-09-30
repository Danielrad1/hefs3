// Core domain model — defined now, even if we use mocks
export type Card = {
  id: string;
  front: string;
  back: string;
  media?: {
    images?: string[];
    audio?: string[];
  };
  // Placeholders for Phase 2+
  easeFactor?: number; // SM-2 param
  interval?: number;
  due?: number; // unix timestamp
  deckId?: string;
};

export type Deck = {
  id: string;
  name: string;
  description?: string;
  cardCount: number;
  createdAt: number;
  updatedAt: number;
};

export type StudySession = {
  id: string;
  deckId: string;
  startedAt: number;
  completedAt?: number;
  cardsStudied: number;
  correctAnswers: number;
};
