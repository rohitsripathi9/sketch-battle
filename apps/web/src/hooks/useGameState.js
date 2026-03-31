import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

export function useGameState({ on, emit, isConnected }) {
  const { user } = useAuth();
  const [gamePhase, setGamePhase] = useState(null);
  const [gameMode, setGameMode] = useState(null);
  const [currentRound, setCurrentRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(0);
  const [currentDrawerUserId, setCurrentDrawerUserId] = useState(null);
  const [currentDrawerUsername, setCurrentDrawerUsername] = useState('');
  const [timerEndMs, setTimerEndMs] = useState(null);
  const [wordHint, setWordHint] = useState('');
  const [drawerWord, setDrawerWord] = useState(null);
  const [wordChoices, setWordChoices] = useState(null);
  const [currentRoundId, setCurrentRoundId] = useState(null);
  const [scores, setScores] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [roundResults, setRoundResults] = useState(null);
  const [gameResults, setGameResults] = useState(null);
  const [correctGuessers, setCorrectGuessers] = useState(new Set());

  // Dual battle state
  const [dualRedDrawerId, setDualRedDrawerId] = useState(null);
  const [dualBlueDrawerId, setDualBlueDrawerId] = useState(null);
  const [myTeam, setMyTeam] = useState(null);
  const [redWordCount, setRedWordCount] = useState(0);
  const [blueWordCount, setBlueWordCount] = useState(0);
  const [dualRoundEnd, setDualRoundEnd] = useState(null);
  const [dualSessionEnd, setDualSessionEnd] = useState(null);

  const isDualBattle = gameMode === 'dual_battle';
  const isDrawer = isDualBattle
    ? (user?.id === dualRedDrawerId || user?.id === dualBlueDrawerId)
    : user?.id === currentDrawerUserId;

  useEffect(() => {
    if (!on || !isConnected) return;

    const unsubs = [
      on('room:state_snapshot', (state) => {
        if (state.phase) setGamePhase(state.phase);
        if (state.mode) setGameMode(state.mode);
        setCurrentRound(state.currentRound || 0);
        setTotalRounds(state.roundCount || 0);
        setCurrentDrawerUserId(state.currentDrawerUserId);
        setTimerEndMs(state.timerEndMs);
        setWordHint(state.wordHint || '');
        setCurrentRoundId(state.currentRoundId);
        if (state.dualRedDrawerId) setDualRedDrawerId(state.dualRedDrawerId);
        if (state.dualBlueDrawerId) setDualBlueDrawerId(state.dualBlueDrawerId);
        if (state.players && user?.id) {
          const me = state.players.find(p => p.userId === user.id);
          if (me?.team && me.team !== 'none') setMyTeam(me.team);
        }
      }),

      on('game:started', (data) => {
        setGamePhase('selecting');
        setTotalRounds(data.roundCount || 0);
        if (data.mode) setGameMode(data.mode);
        setScores([]);
        setRoundResults(null);
        setGameResults(null);
        setChatMessages([]);
        setRedWordCount(0);
        setBlueWordCount(0);
        setDualRoundEnd(null);
        setDualSessionEnd(null);
        if (data.mode === 'dual_battle') {
          setGamePhase('drawing');
        }
      }),

      on('round:selecting', (data) => {
        setGamePhase('selecting');
        setCurrentRound(data.roundNumber);
        setTotalRounds(prev => data.totalRounds || prev);
        setCurrentDrawerUserId(data.drawerUserId);
        setCurrentDrawerUsername(data.drawerUsername || '');
        setTimerEndMs(null);
        setWordHint('');
        setDrawerWord(null);
        setRoundResults(null);
        setCorrectGuessers(new Set());
        setChatMessages([]);
      }),

      on('round:word_choices', (data) => {
        setWordChoices(data.words);
        setGamePhase('selecting');
      }),

      on('round:word_select', () => {
        setWordChoices(null);
      }),

      on('round:start', (data) => {
        setGamePhase('drawing');
        setCurrentRound(data.roundNumber);
        setTotalRounds(prev => data.totalRounds || prev);
        setCurrentDrawerUserId(data.drawerUserId);
        setTimerEndMs(data.timerEndMs);
        setWordHint(data.wordHint || '');
        setCurrentRoundId(data.roundId);
        setDrawerWord(null);
        setWordChoices(null);
        setRoundResults(null);
        setDualRoundEnd(null);
        setCorrectGuessers(new Set());
        if (data.drawerUserId) {
          setCurrentDrawerUsername(data.drawerUsername || '');
        }
        if (data.team) {
          setMyTeam(data.team);
          if (data.team === 'red') setDualRedDrawerId(data.drawerUserId);
          if (data.team === 'blue') setDualBlueDrawerId(data.drawerUserId);
        }
      }),

      on('round:word_reveal', (data) => {
        setDrawerWord(data.word);
      }),

      on('round:hint_reveal', (data) => {
        setWordHint(data.hintPattern);
      }),

      on('round:end', (data) => {
        setGamePhase('round_end');
        setRoundResults(data);
        setTimerEndMs(null);
        setDrawerWord(null);
        setWordChoices(null);
        if (data.scores) setScores(data.scores);
      }),

      on('game:end', (data) => {
        setGamePhase('game_over');
        setGameResults(data);
        setTimerEndMs(null);
      }),

      on('guess:result', (data) => {
        if (data.isCorrect) {
          setCorrectGuessers(prev => new Set([...prev, data.userId]));
        }
        setChatMessages(prev => [...prev, {
          id: Date.now() + Math.random(),
          userId: data.userId,
          username: data.username,
          text: data.isCorrect ? `guessed the word!` : null,
          isCorrect: data.isCorrect,
          score: data.score,
          timestamp: Date.now(),
        }]);
      }),

      on('score:update', (data) => {
        if (data.scores) setScores(data.scores);
      }),

      on('chat:message', (data) => {
        setChatMessages(prev => [...prev, {
          id: Date.now() + Math.random(),
          userId: data.userId,
          username: data.username,
          text: data.text,
          isGuess: data.isGuess,
          isClose: data.isClose,
          timestamp: data.timestamp,
        }]);
      }),

      // Dual battle events
      on('dual:word_guessed', (data) => {
        if (data.team === 'red') setRedWordCount(data.wordCount);
        if (data.team === 'blue') setBlueWordCount(data.wordCount);
        setCorrectGuessers(prev => new Set([...prev, data.userId]));
        setChatMessages(prev => [...prev, {
          id: Date.now() + Math.random(),
          userId: data.userId,
          username: data.username,
          text: `guessed the word! (+${data.score})`,
          isCorrect: true,
          score: data.score,
          team: data.team,
          timestamp: Date.now(),
        }]);
      }),

      on('dual:round_end', (data) => {
        setGamePhase('round_end');
        setDualRoundEnd(data);
        setTimerEndMs(null);
        setDrawerWord(null);
        if (data.scores) setScores(data.scores);
        setRedWordCount(data.redWordCount || 0);
        setBlueWordCount(data.blueWordCount || 0);
      }),

      on('dual:session_end', (data) => {
        setGamePhase('game_over');
        setDualSessionEnd(data);
        setGameResults(data);
        setTimerEndMs(null);
      }),
    ];

    return () => unsubs.forEach(u => u?.());
  }, [on, isConnected, user?.id]);

  const selectWord = useCallback((index) => {
    emit?.('round:word_select', { wordIndex: index });
    setWordChoices(null);
  }, [emit]);

  const submitGuess = useCallback((text) => {
    if (!text.trim()) return;
    emit?.('guess:submit', { text: text.trim() });
  }, [emit]);

  const startGame = useCallback((callback) => {
    emit?.('game:start', {}, callback);
  }, [emit]);

  return {
    gamePhase,
    gameMode,
    isDualBattle,
    currentRound,
    totalRounds,
    currentDrawerUserId,
    currentDrawerUsername,
    isDrawer,
    timerEndMs,
    wordHint,
    drawerWord,
    wordChoices,
    currentRoundId,
    scores,
    chatMessages,
    roundResults,
    gameResults,
    correctGuessers,
    // Dual specific
    dualRedDrawerId,
    dualBlueDrawerId,
    myTeam,
    redWordCount,
    blueWordCount,
    dualRoundEnd,
    dualSessionEnd,
    // Actions
    selectWord,
    submitGuess,
    startGame,
  };
}
