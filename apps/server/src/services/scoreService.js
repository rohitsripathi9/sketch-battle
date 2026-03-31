import { GAME } from '@sketchbattle/shared';

/**
 * Scribble-style guesser scoring (strict):
 *  - Base: 500 points for guessing instantly, drops linearly to 100 at timer end
 *  - Position penalty: each prior correct guesser reduces by 10% (min 40% of base)
 *  - Difficulty multiplier on top
 *  - Minimum 50 points for any correct guess
 *  - 0 points if you didn't guess
 */
export function calculateGuesserScore({
  remainingMs,
  totalMs,
  correctGuessCount,
  totalPlayers,
  difficulty = 'medium',
}) {
  if (totalMs <= 0) return 50;
  const timeFraction = Math.max(0, Math.min(1, remainingMs / totalMs));
  const baseScore = 100 + Math.floor(400 * timeFraction);
  const positionPenalty = Math.max(0.4, 1 - correctGuessCount * 0.1);
  const diffMult = GAME.DIFFICULTY_MULTIPLIER[difficulty] || 1.0;
  return Math.max(50, Math.floor(baseScore * positionPenalty * diffMult));
}

/**
 * Drawer scoring (strict Scribble-like):
 * - 0 points if nobody guessed
 * - Points proportional to how many guessed: max 250 if everyone guesses
 * - Bonus: +50 if all guessers got it
 */
export function calculateDrawerScore(correctCount, totalGuessers) {
  if (correctCount === 0 || totalGuessers === 0) return 0;
  const ratio = correctCount / totalGuessers;
  const base = Math.floor(ratio * 250);
  const allCorrectBonus = correctCount >= totalGuessers ? 50 : 0;
  return base + allCorrectBonus;
}

export function calculateDualScore({ remainingMs, totalMs, difficulty = 'medium' }) {
  const diffMult = GAME.DIFFICULTY_MULTIPLIER[difficulty] || 1.0;
  return Math.floor(GAME.DUAL_BASE_SCORE * diffMult * (remainingMs / totalMs));
}
