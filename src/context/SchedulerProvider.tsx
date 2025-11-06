/**
 * Scheduler Provider
 * React context for accessing scheduler state and methods
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Card } from '../domain/models';
import { Difficulty } from '../domain/srsTypes';
import { db } from '../services/anki/InMemoryDb';
import { SchedulerV2 } from '../services/anki/SchedulerV2';
import { CardType, RevlogEase } from '../services/anki/schema';
import { toViewCard, bootstrapFromSeed } from '../services/anki/Adapter';
import { isDue } from '../services/anki/time';
import { todayUsageRepository, TodayUsageRepository } from '../services/anki/db/TodayUsageRepository';
import { TodayCountsService } from '../services/anki/TodayCountsService';
import { PersistenceService } from '../services/anki/PersistenceService';
import { logger } from '../utils/logger';

interface SchedulerContextValue {
  current: Card | null;
  next: Card | null;
  cardType: CardType | null;
  currentDeckId: string | null;
  answer: (difficulty: Difficulty, responseTimeMs: number) => void;
  bootstrap: (cards: Card[]) => void;
  setDeck: (deckId: string | null) => void;
  reload: () => void;
  stats: {
    newCount: number;
    learningCount: number;
    reviewCount: number;
    totalCards: number;
  };
  decks: Array<{ id: string; name: string; cardCount: number; dueCount: number }>;
}

const SchedulerContext = createContext<SchedulerContextValue | null>(null);

export function SchedulerProvider({ children }: { children: React.ReactNode }) {
  const [scheduler] = useState(() => new SchedulerV2(db));
  const [current, setCurrent] = useState<Card | null>(null);
  const [next, setNext] = useState<Card | null>(null);
  const [cardType, setCardType] = useState<CardType | null>(null);
  const [currentDeckId, setCurrentDeckId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    newCount: 0,
    learningCount: 0,
    reviewCount: 0,
    totalCards: 0,
  });
  const [decks, setDecks] = useState<Array<{ id: string; name: string; cardCount: number; dueCount: number }>>([]);
  
  // Debounced save timer
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load current and next cards (optimized - no deck stats recalculation)
  const loadCards = useCallback(() => {
    const currentAnkiCard = scheduler.getNext(currentDeckId || undefined);
    const nextAnkiCard = currentAnkiCard ? scheduler.peekNext(currentDeckId || undefined) : null;

    if (currentAnkiCard) {
      try {
        setCurrent(toViewCard(currentAnkiCard, db));
        setCardType(currentAnkiCard.type);
      } catch (error) {
        logger.error('[SchedulerProvider] Error loading current card:', error);
        // Skip this card and try to get next one
        setCurrent(null);
        setCardType(null);
      }
    } else {
      setCurrent(null);
      setCardType(null);
    }

    if (nextAnkiCard && nextAnkiCard.id !== currentAnkiCard?.id) {
      try {
        setNext(toViewCard(nextAnkiCard, db));
      } catch (error) {
        logger.error('[SchedulerProvider] Error loading next card:', error);
        setNext(null);
      }
    } else {
      setNext(null);
    }

    // Update stats (much faster than deck list)
    setStats(db.getStats(currentDeckId || undefined));
  }, [scheduler, currentDeckId]);

  // Separate function to update deck list (only called when needed)
  const updateDeckList = useCallback(() => {
    // Update decks list with due counts (exclude Default deck)
    const allDecks = db.getAllDecks().filter(d => d.id !== '1');
    const allCards = db.getAllCards();
    const todayCountsService = new TodayCountsService(db);
    
    // Build a map of deck name -> card counts
    const deckCardsMap = new Map<string, number>();
    
    // Initialize all decks with zero counts
    allDecks.forEach(d => {
      deckCardsMap.set(d.name, 0);
    });
    
    // Single pass: count total cards for each deck (including parent decks)
    allCards.forEach(card => {
      const cardDeck = db.getDeck(card.did);
      if (!cardDeck) return;
      
      // Update this deck and all parent decks
      // e.g., "A::B::C" should update "A", "A::B", and "A::B::C"
      const parts = cardDeck.name.split('::');
      for (let i = 1; i <= parts.length; i++) {
        const deckName = parts.slice(0, i).join('::');
        const count = deckCardsMap.get(deckName);
        if (count !== undefined) {
          deckCardsMap.set(deckName, count + 1);
        }
      }
    });
    
    // Get accurate due counts from TodayCountsService (respects daily limits)
    // First, calculate due counts for each deck (their own cards only)
    const deckOwnDueCounts = new Map<string, number>();
    allDecks.forEach(d => {
      const deckCounts = todayCountsService.getDeckTodayCounts(d.id);
      deckOwnDueCounts.set(d.name, deckCounts.dueTodayTotal);
    });
    
    // Then, calculate total due counts including children (bottom-up aggregation)
    const deckDueCounts = new Map<string, number>();
    
    // Process decks from deepest to shallowest (by :: count)
    const sortedDecks = [...allDecks].sort((a, b) => {
      const aDepth = a.name.split('::').length;
      const bDepth = b.name.split('::').length;
      return bDepth - aDepth; // Deepest first
    });
    
    sortedDecks.forEach(d => {
      // Start with this deck's own due count
      let totalDue = deckOwnDueCounts.get(d.name) || 0;
      
      // Add all direct children's totals
      sortedDecks.forEach(child => {
        if (child.name.startsWith(d.name + '::') && 
            child.name.split('::').length === d.name.split('::').length + 1) {
          totalDue += deckDueCounts.get(child.name) || 0;
        }
      });
      
      deckDueCounts.set(d.name, totalDue);
    });
    
    // Map decks to final structure
    setDecks(allDecks.map(d => {
      const cardCount = deckCardsMap.get(d.name) || 0;
      const dueCount = deckDueCounts.get(d.name) || 0;
      return {
        id: d.id,
        name: d.name,
        cardCount,
        dueCount,
      };
    }));
  }, []);

  // Bootstrap with seed data
  const bootstrap = useCallback((cards: Card[]) => {
    db.clear();
    bootstrapFromSeed(db, cards);
    loadCards();
  }, [loadCards]);

  // Set active deck
  const setDeck = useCallback((deckId: string | null) => {
    setCurrentDeckId(deckId);
  }, []);

  // Answer current card
  const answer = useCallback((difficulty: Difficulty, responseTimeMs: number) => {
    if (!current) {
      logger.warn('No current card to answer');
      return;
    }

    // Map difficulty to Anki ease
    let ease: RevlogEase;
    
    // For learning cards, only 3 buttons: Again=1, Good=2, Easy=3
    // For review cards, 4 buttons: Again=1, Hard=2, Good=3, Easy=4
    const isLearning = cardType === CardType.New || 
                       cardType === CardType.Learning || 
                       cardType === CardType.Relearning;

    if (isLearning) {
      // Learning: map to 3-button ease
      switch (difficulty) {
        case 'again':
          ease = RevlogEase.Again;  // 1
          break;
        case 'good':
          ease = RevlogEase.Good;   // 2 (mapped from "good")
          break;
        case 'easy':
          ease = RevlogEase.Easy;   // 3
          break;
        case 'hard':
          // Treat "hard" as "good" for learning
          ease = RevlogEase.Good;   // 2
          break;
        default:
          ease = RevlogEase.Good;
      }
    } else {
      // Review: map to 4-button ease
      switch (difficulty) {
        case 'again':
          ease = RevlogEase.Again;  // 1
          break;
        case 'hard':
          ease = RevlogEase.Hard;   // 2
          break;
        case 'good':
          ease = RevlogEase.Good;   // 3
          break;
        case 'easy':
          ease = RevlogEase.Easy;   // 4
          break;
        default:
          ease = RevlogEase.Good;
      }
    }

    // Track today's usage BEFORE answering (to detect type transitions)
    const wasNewCard = cardType === CardType.New;
    const wasReviewOrRelearn = cardType === CardType.Review || cardType === CardType.Relearning;
    
    // Process answer
    scheduler.answer(current.id, ease, responseTimeMs);
    
    // Increment today's usage counters
    const colConfig = db.getColConfig();
    const dayKey = TodayUsageRepository.getDayKey(colConfig);
    const ankiCard = db.getCard(current.id);
    if (ankiCard) {
      if (wasNewCard) {
        // New card was introduced today
        todayUsageRepository.incrementNewIntroduced(ankiCard.did, dayKey);
      } else if (wasReviewOrRelearn) {
        // Review or relearning card was done today
        todayUsageRepository.incrementReviewDone(ankiCard.did, dayKey);
      }
    }

    // Load next cards - no sibling burying to ensure peeked card is always the next card
    loadCards();

    // Debounced save to persist review progress
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(async () => {
      await PersistenceService.save(db).catch((error) => {
        logger.error('[SchedulerProvider] Error saving after review:', error);
      });
    }, 500);
  }, [current, cardType, scheduler, loadCards]);

  // Reload cards when deck changes or on mount
  useEffect(() => {
    if (currentDeckId) {
      // Use setTimeout to prevent blocking UI when switching decks
      const timer = setTimeout(() => {
        loadCards();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [currentDeckId, loadCards]);


  // Reload function to refresh from database
  const reload = useCallback(() => {
    loadCards();
    // Also update deck list when explicitly reloading
    updateDeckList();
  }, [loadCards, updateDeckList]);

  // Load cards on mount
  useEffect(() => {
    loadCards();
    updateDeckList();
  }, []);

  // Cleanup save timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const value: SchedulerContextValue = {
    current,
    next,
    cardType,
    currentDeckId,
    answer,
    bootstrap,
    setDeck,
    reload,
    stats,
    decks,
  };

  return (
    <SchedulerContext.Provider value={value}>
      {children}
    </SchedulerContext.Provider>
  );
}

export function useScheduler(): SchedulerContextValue {
  const context = useContext(SchedulerContext);
  if (!context) {
    throw new Error('useScheduler must be used within SchedulerProvider');
  }
  return context;
}
