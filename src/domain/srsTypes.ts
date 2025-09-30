// SRS (Spaced Repetition System) types for future phases
export type Difficulty = 'again' | 'hard' | 'good' | 'easy';

export type ReviewResult = {
  cardId: string;
  difficulty: Difficulty;
  responseTime: number; // milliseconds
  timestamp: number; // unix timestamp
};

export type SRSCard = {
  id: string;
  // SM-2 Algorithm fields
  easeFactor: number; // default 2.5
  interval: number; // days until next review
  repetitions: number; // number of successful reviews
  due: number; // unix timestamp when card is due
  lastReviewed?: number; // unix timestamp of last review
  
  // Learning state
  isNew: boolean;
  isLearning: boolean;
  isReview: boolean;
  
  // Statistics
  totalReviews: number;
  correctReviews: number;
  averageResponseTime: number;
};

export type SchedulerConfig = {
  // SM-2 parameters
  minEaseFactor: number; // default 1.3
  maxEaseFactor: number; // default 2.5
  easeFactorModifier: number; // default 0.15
  
  // Interval multipliers
  againMultiplier: number; // default 0.0 (restart)
  hardMultiplier: number; // default 1.2
  goodMultiplier: number; // default 1.0 (use ease factor)
  easyMultiplier: number; // default 1.3
  
  // Learning steps (minutes)
  learningSteps: number[]; // default [1, 10]
  graduatingInterval: number; // default 1 day
  easyInterval: number; // default 4 days
};
