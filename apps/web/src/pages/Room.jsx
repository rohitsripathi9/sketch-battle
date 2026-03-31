import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { useGameState } from '../hooks/useGameState';
import { useCanvas } from '../hooks/useCanvas';
import { apiGetRoom } from '../lib/api';
import Button from '../components/Button';
import DrawingCanvas from '../components/DrawingCanvas';
import ToolBar from '../components/ToolBar';
import TimerBar from '../components/TimerBar';
import WordDisplay from '../components/WordDisplay';
import WordChoices from '../components/WordChoices';
import GuessInput from '../components/GuessInput';
import ChatPanel from '../components/ChatPanel';
import ScoreBoard from '../components/ScoreBoard';
import GameResults from '../components/GameResults';
import RoundResults from '../components/RoundResults';
import DualBattleHUD from '../components/DualBattleHUD';
import { useSFX as useSFXHook } from '../context/SFXContext';

export default function Room() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isConnected, emit, on } = useSocket();

  const [roomState, setRoomState] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [startError, setStartError] = useState('');
  const joinedRef = useRef(false);
  const joinAttemptRef = useRef(0);
  const canvasHookRef = useRef(null);

  const game = useGameState({ on, emit, isConnected });

  const canvasHook = useCanvas({
    isDrawer: game.isDrawer,
    onStroke: useCallback((data) => {
      emit?.('canvas:stroke', data, () => {});
    }, [emit]),
    onUndo: useCallback((seq) => {
      emit?.('canvas:undo', { targetSeq: seq });
    }, [emit]),
    onClear: useCallback(() => {
      emit?.('canvas:clear');
    }, [emit]),
  });
  canvasHookRef.current = canvasHook;

  useEffect(() => {
    if (!on || !isConnected) return;

    function handleSnapshot(state) {
      setRoomState(state);
      setPlayers(state.players || []);
      setLoading(false);
      setError('');
      joinedRef.current = true;
    }
    function handlePlayersUpdate(data) {
      if (data.players) setPlayers(data.players);
    }
    function handlePlayerJoined(data) {
      setPlayers(prev => {
        if (prev.find(p => p.userId === data.userId)) return prev;
        return [...prev, {
          userId: data.userId, username: data.username,
          role: data.role, team: data.team, score: 0, isConnected: true,
        }];
      });
    }
    function handlePlayerDisconnected(data) {
      setPlayers(prev => prev.map(p =>
        p.userId === data.userId ? { ...p, isConnected: false } : p
      ));
    }
    function handlePlayerReconnected(data) {
      setPlayers(prev => prev.map(p =>
        p.userId === data.userId ? { ...p, isConnected: true } : p
      ));
    }
    function handlePlayerLeft(data) {
      setPlayers(prev => prev.filter(p => p.userId !== data.userId));
    }
    function handleError(data) {
      setError(data.message || 'Something went wrong');
    }

    const unsubs = [
      on('room:state_snapshot', handleSnapshot),
      on('room:players_update', handlePlayersUpdate),
      on('player:joined', handlePlayerJoined),
      on('player:disconnected', handlePlayerDisconnected),
      on('player:reconnected', handlePlayerReconnected),
      on('player:left', handlePlayerLeft),
      on('error:game', handleError),
    ];

    return () => unsubs.forEach(u => u?.());
  }, [on, isConnected]);

  useEffect(() => {
    if (!isConnected || !code) return;

    joinedRef.current = false;
    joinAttemptRef.current = 0;

    function attemptJoin() {
      if (joinedRef.current || joinAttemptRef.current >= 99) return;

      const attempt = ++joinAttemptRef.current;

      emit('room:join', { roomCode: code.toUpperCase() }, (response) => {
        if (!response) {
          if (!joinedRef.current && joinAttemptRef.current <= 3) {
            setTimeout(attemptJoin, 2000);
          } else if (!joinedRef.current) {
            setError('Could not connect to the server');
            setLoading(false);
          }
          return;
        }

        if (response?.error) {
          if (!joinedRef.current && joinAttemptRef.current <= 3) {
            setTimeout(attemptJoin, 1500);
          } else if (!joinedRef.current) {
            setError(response.error);
            setLoading(false);
          }
        } else {
          joinedRef.current = true;
          setError('');
          setLoading(false);
        }
      });
    }

    attemptJoin();

    return () => {
      joinAttemptRef.current = 99;
    };
  }, [isConnected, code, emit]);

  useEffect(() => {
    if (!isConnected || game.isDrawer) return;
    const unsubs = [
      on('canvas:stroke_broadcast', (data) => {
        canvasHookRef.current?.applyRemoteStroke(data);
      }),
      on('canvas:undo_broadcast', () => {
        emit?.('canvas:sync_request', { lastKnownSeq: 0 }, (resp) => {
          if (resp?.strokes) canvasHookRef.current?.replayStrokes(resp.strokes);
        });
      }),
      on('canvas:cleared', () => {
        canvasHookRef.current?.clearCanvasRemote();
      }),
    ];
    return () => unsubs.forEach(u => u?.());
  }, [isConnected, on, game.isDrawer, emit]);

  useEffect(() => {
    if (game.gamePhase === 'drawing' && !game.isDrawer && game.currentRoundId) {
      setTimeout(() => {
        emit?.('canvas:sync_request', { lastKnownSeq: 0 }, (resp) => {
          if (resp?.strokes && resp.strokes.length > 0) {
            canvasHookRef.current?.replayStrokes(resp.strokes);
          }
        });
      }, 300);
    }
    if (game.gamePhase === 'drawing') {
      canvasHookRef.current?.clearCanvasRemote();
    }
  }, [game.gamePhase, game.currentRoundId, emit, game.isDrawer]);

  useEffect(() => {
    if (!loading || joinedRef.current) return;
    const timer = setTimeout(async () => {
      if (loading && !joinedRef.current) {
        try {
          const data = await apiGetRoom(code);
          if (!roomState) {
            setRoomState({
              roomCode: code.toUpperCase(), mode: data.room.mode,
              status: data.room.status, maxPlayers: data.room.maxPlayers,
              roundCount: data.room.roundCount, drawTimeSecs: data.room.drawTimeSecs,
              hostUserId: data.room.hostUserId, hostName: data.room.hostName,
            });
          }
        } catch { /* ignore */ }
        setLoading(false);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [loading, code, roomState]);

  function copyCode() {
    navigator.clipboard?.writeText(code?.toUpperCase() || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleStartGame() {
    setStartError('');
    game.startGame((resp) => {
      if (resp?.error) setStartError(resp.error);
    });
  }

  const isHost = roomState?.hostUserId === user?.id;
  const isDual = roomState?.mode === 'dual_battle' || game.isDualBattle;

  const playersWithScores = players.map(p => {
    const scoreEntry = game.scores.find(s => s.userId === p.userId);
    return scoreEntry ? { ...p, score: scoreEntry.score } : p;
  });

  const activePlayers = playersWithScores.filter(p => p.role === 'player');
  const isGameActive = game.gamePhase === 'drawing' || game.gamePhase === 'selecting' || game.gamePhase === 'round_end';
  const hasGuessedCorrectly = game.correctGuessers.has(user?.id);

  const redPlayers = playersWithScores.filter(p => p.team === 'red');
  const bluePlayers = playersWithScores.filter(p => p.team === 'blue');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4 animate-fade-in panel-3d p-10">
          <svg className="animate-spin h-12 w-12 text-accent-purple" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="6" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-xl font-bold text-slate-700">Joining room <span className="font-mono font-black text-accent-purple">{code?.toUpperCase()}</span>...</p>
        </div>
      </div>
    );
  }

  if (error && !joinedRef.current) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4 animate-fade-in panel-3d p-10 max-w-sm mx-4 text-center">
          <div className="w-20 h-20 rounded-3xl bg-red-100 border-4 border-red-200 flex items-center justify-center text-5xl shadow-inner rotate-[-5deg]">!</div>
          <h2 className="text-2xl font-black text-slate-800">{error}</h2>
          <Button onClick={() => navigate('/lobby')} fullWidth>Back to Lobby</Button>
        </div>
      </div>
    );
  }

  // Game Over
  if (game.gamePhase === 'game_over') {
    if (isDual && game.dualSessionEnd) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <DualGameOver data={game.dualSessionEnd} onBack={() => navigate('/lobby')} myTeam={game.myTeam} />
        </div>
      );
    }
    return (
      <>
        <div className="min-h-screen bg-slate-50" />
        <GameResults results={game.gameResults} onBackToLobby={() => navigate('/lobby')} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">

      {game.wordChoices && game.isDrawer && (
        <WordChoices words={game.wordChoices} onSelect={game.selectWord} />
      )}

      {/* Header */}
      <header className="bg-accent-cyan border-b-4 border-cyan-600 shadow-md">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/lobby')} className="bg-white hover:bg-slate-100 border-2 border-slate-200 text-slate-800 shadow-[0_2px_0_#cbd5e1] active:translate-y-0.5 active:shadow-none transition-all text-xs px-2 py-1">
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Leave
            </Button>
            {isGameActive && (
              <span className="text-xs font-black text-white/80 uppercase tracking-widest bg-black/15 px-2 py-1 rounded-lg">
                R{game.currentRound}/{game.totalRounds}
              </span>
            )}
            {isDual && isGameActive && (
              <span className="text-xs font-black text-yellow-200 uppercase tracking-wider bg-black/20 px-2 py-1 rounded-lg">
                2v2
              </span>
            )}
          </div>

          {isGameActive && game.gamePhase !== 'selecting' && !isDual && (
            <div className="flex-1 px-4">
              <WordDisplay
                isDrawer={game.isDrawer}
                word={game.drawerWord}
                hint={game.wordHint}
                roundNumber={game.currentRound}
                totalRounds={game.totalRounds}
              />
            </div>
          )}

          {isGameActive && isDual && (
            <div className="flex-1 px-4 text-center">
              <span className="font-mono font-black text-lg text-white tracking-[0.3em]">
                {game.isDrawer ? game.drawerWord || '' : game.wordHint || ''}
              </span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button onClick={copyCode}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border-2 border-slate-200 shadow-[0_2px_0_#cbd5e1] hover:-translate-y-0.5 hover:border-accent-purple transition-all cursor-pointer active:translate-y-0.5 active:shadow-none">
              <span className="font-mono font-black text-sm tracking-widest text-accent-purple">{code?.toUpperCase()}</span>
              {copied ? (
                <svg className="w-4 h-4 text-accent-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
            <span className={`w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm ${isConnected ? 'bg-accent-green' : 'bg-accent-red'}`} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-4">
        {!isGameActive && game.gamePhase !== 'round_end' ? (
          /* Waiting Room */
          isDual ? (
            <DualWaitingRoom
              roomState={roomState}
              redPlayers={redPlayers}
              bluePlayers={bluePlayers}
              activePlayers={activePlayers}
              isHost={isHost}
              code={code}
              copied={copied}
              copyCode={copyCode}
              handleStartGame={handleStartGame}
              startError={startError}
            />
          ) : (
            <StandardWaitingRoom
              roomState={roomState}
              activePlayers={activePlayers}
              playersWithScores={playersWithScores}
              isHost={isHost}
              code={code}
              copied={copied}
              copyCode={copyCode}
              handleStartGame={handleStartGame}
              startError={startError}
            />
          )
        ) : isDual ? (
          /* Dual Battle Active */
          <DualBattleView
            game={game}
            canvasHook={canvasHook}
            playersWithScores={playersWithScores}
            redPlayers={redPlayers}
            bluePlayers={bluePlayers}
            user={user}
            navigate={navigate}
          />
        ) : (
          /* Standard Game Active */
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-1 order-2 lg:order-1">
              <div className="panel-3d p-4 bg-white">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 border-b-2 border-slate-100 pb-2">Scoreboard</h3>
                <ScoreBoard players={playersWithScores} currentDrawerUserId={game.currentDrawerUserId}
                  correctGuessers={game.correctGuessers} />
              </div>
            </div>

            <div className="lg:col-span-2 order-1 lg:order-2">
              {game.gamePhase === 'round_end' ? (
                <RoundResults results={game.roundResults} />
              ) : game.gamePhase === 'selecting' ? (
                <div className="panel-3d bg-white p-8 flex flex-col items-center justify-center min-h-[400px] animate-fade-in">
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">
                    Round {game.currentRound} / {game.totalRounds}
                  </p>
                  <h2 className="text-2xl font-black text-slate-800 mb-6 text-center">
                    {game.isDrawer
                      ? 'Choose a word to draw!'
                      : `${game.currentDrawerUsername || 'Drawer'} is choosing a word...`
                    }
                  </h2>
                  <div className="flex items-center gap-2 bg-purple-50 px-4 py-2 rounded-xl border-2 border-purple-200">
                    <svg className="animate-spin h-5 w-5 text-accent-purple" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="6" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-sm font-bold text-purple-700">Get ready...</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-3">
                    <TimerBar timerEndMs={game.timerEndMs} />
                  </div>
                  <DrawingCanvas canvasHook={canvasHook} isDrawer={game.isDrawer} />
                  {game.isDrawer && game.gamePhase === 'drawing' && (
                    <div className="mt-3">
                      <ToolBar
                        tool={canvasHook.tool} setTool={canvasHook.setTool}
                        color={canvasHook.color} setColor={canvasHook.setColor}
                        brushSize={canvasHook.brushSize} setBrushSize={canvasHook.setBrushSize}
                        canUndo={canvasHook.canUndo} onUndo={canvasHook.undo}
                        onClear={canvasHook.clearCanvas}
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="lg:col-span-1 order-3 flex flex-col h-full">
              <div className="panel-3d p-4 flex flex-col h-full bg-white flex-1 min-h-[350px]">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 border-b-2 border-slate-100 pb-2">Chat</h3>
                <div className="flex-1 min-h-0 mb-3">
                  <ChatPanel messages={game.chatMessages} />
                </div>
                {game.gamePhase === 'drawing' && (
                  <GuessInput
                    onSubmit={game.submitGuess}
                    disabled={game.gamePhase !== 'drawing'}
                    isDrawer={game.isDrawer}
                    hasGuessedCorrectly={hasGuessedCorrectly}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Dual Battle: Waiting Room ──────────────────────────
function DualWaitingRoom({ roomState, redPlayers, bluePlayers, activePlayers, isHost, code, copied, copyCode, handleStartGame, startError }) {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="panel-3d p-6 bg-white text-center">
        <h1 className="text-2xl font-black text-slate-800 uppercase mb-1">2v2 Battle</h1>
        <p className="text-sm font-bold text-slate-400 mb-4">4 players needed to start</p>
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="font-mono font-black text-lg tracking-widest text-accent-purple bg-purple-50 px-4 py-1.5 rounded-xl border-2 border-purple-200">{code?.toUpperCase()}</span>
          <Button variant="secondary" size="sm" onClick={copyCode}>{copied ? 'Copied!' : 'Copy'}</Button>
        </div>
        <div className="flex items-center justify-center gap-2 text-sm font-bold text-slate-500">
          <span>{roomState?.roundCount} rounds</span>
          <span className="text-slate-300">|</span>
          <span>60s per round</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Red Team */}
        <div className="panel-3d p-4 bg-red-50 border-team-red">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-red-200">
            <div className="w-3 h-3 rounded-full bg-team-red" />
            <h3 className="text-sm font-black text-red-700 uppercase">Red Team</h3>
            <span className="text-xs font-bold text-red-400 ml-auto">{redPlayers.length}/2</span>
          </div>
          <div className="space-y-2">
            {redPlayers.map(p => (
              <MiniPlayerCard key={p.userId} player={p} hostId={roomState?.hostUserId} />
            ))}
            {redPlayers.length < 2 && (
              <div className="text-center py-3 text-xs font-bold text-red-300 border-2 border-dashed border-red-200 rounded-xl">
                Waiting...
              </div>
            )}
          </div>
        </div>

        {/* Blue Team */}
        <div className="panel-3d p-4 bg-blue-50 border-team-blue">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-blue-200">
            <div className="w-3 h-3 rounded-full bg-team-blue" />
            <h3 className="text-sm font-black text-blue-700 uppercase">Blue Team</h3>
            <span className="text-xs font-bold text-blue-400 ml-auto">{bluePlayers.length}/2</span>
          </div>
          <div className="space-y-2">
            {bluePlayers.map(p => (
              <MiniPlayerCard key={p.userId} player={p} hostId={roomState?.hostUserId} />
            ))}
            {bluePlayers.length < 2 && (
              <div className="text-center py-3 text-xs font-bold text-blue-300 border-2 border-dashed border-blue-200 rounded-xl">
                Waiting...
              </div>
            )}
          </div>
        </div>
      </div>

      {isHost && activePlayers.length === 4 && (
        <div className="text-center">
          <Button size="lg" onClick={handleStartGame} className="animate-pulse-glow">
            Start 2v2 Battle
          </Button>
          {startError && <p className="text-sm font-bold text-accent-red mt-2">{startError}</p>}
        </div>
      )}
      {isHost && activePlayers.length < 4 && (
        <p className="text-center text-sm font-bold text-slate-400">Need {4 - activePlayers.length} more player{4 - activePlayers.length > 1 ? 's' : ''}</p>
      )}
      {!isHost && activePlayers.length === 4 && (
        <p className="text-center text-sm font-bold text-slate-400">Waiting for host to start...</p>
      )}
    </div>
  );
}

// ─── Dual Battle: Active Game View ──────────────────────
function DualBattleView({ game, canvasHook, playersWithScores, redPlayers, bluePlayers, user, navigate }) {
  const hasGuessed = game.correctGuessers.has(user?.id);

  if (game.gamePhase === 'round_end' && game.dualRoundEnd) {
    return <DualRoundEnd data={game.dualRoundEnd} />;
  }

  return (
    <div className="space-y-3">
      {/* Team HUD */}
      <DualBattleHUD
        players={playersWithScores}
        scores={game.scores}
        redWordCount={game.redWordCount}
        blueWordCount={game.blueWordCount}
      />

      {/* Timer */}
      {game.gamePhase === 'drawing' && (
        <TimerBar timerEndMs={game.timerEndMs} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Canvas */}
        <div className="lg:col-span-2">
          {game.isDrawer ? (
            <>
              <div className="mb-1 text-center">
                <span className="text-xs font-black uppercase text-accent-purple bg-purple-50 px-3 py-1 rounded-lg border border-purple-200">
                  You are drawing: {game.drawerWord || '...'}
                </span>
              </div>
              <DrawingCanvas canvasHook={canvasHook} isDrawer={true} />
              <div className="mt-2">
                <ToolBar
                  tool={canvasHook.tool} setTool={canvasHook.setTool}
                  color={canvasHook.color} setColor={canvasHook.setColor}
                  brushSize={canvasHook.brushSize} setBrushSize={canvasHook.setBrushSize}
                  canUndo={canvasHook.canUndo} onUndo={canvasHook.undo}
                  onClear={canvasHook.clearCanvas}
                />
              </div>
            </>
          ) : (
            <>
              <div className="mb-1 text-center">
                <span className="text-xs font-black uppercase text-slate-500 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                  Guess the word: <span className="tracking-[0.2em] text-accent-purple">{game.wordHint}</span>
                </span>
              </div>
              <DrawingCanvas canvasHook={canvasHook} isDrawer={false} />
            </>
          )}
        </div>

        {/* Chat + Guess */}
        <div className="lg:col-span-1 flex flex-col">
          <div className="panel-3d p-3 flex flex-col bg-white flex-1 min-h-[300px]">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-100 pb-1">
              Team Chat
            </h3>
            <div className="flex-1 min-h-0 mb-2">
              <ChatPanel messages={game.chatMessages} />
            </div>
            {game.gamePhase === 'drawing' && !game.isDrawer && (
              <GuessInput
                onSubmit={game.submitGuess}
                disabled={game.gamePhase !== 'drawing'}
                isDrawer={game.isDrawer}
                hasGuessedCorrectly={hasGuessed}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Dual Round End ────────────────────────────────────
function DualRoundEnd({ data }) {
  const redWon = (data.redWordCount || 0) > (data.blueWordCount || 0);
  const blueWon = (data.blueWordCount || 0) > (data.redWordCount || 0);
  const tie = !redWon && !blueWon;

  return (
    <div className="max-w-lg mx-auto panel-3d p-6 bg-white text-center animate-fade-in">
      <p className="text-xs font-black text-slate-400 uppercase mb-1">Round {data.roundNumber} Result</p>
      <p className="text-lg font-black text-slate-800 mb-4">Word: <span className="text-accent-purple">{data.word}</span></p>

      <div className="flex items-center justify-center gap-4 mb-4">
        <div className={`flex-1 rounded-xl p-3 border-2 ${redWon ? 'border-team-red bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
          <div className="text-xs font-bold text-red-600 uppercase mb-1">Red</div>
          <div className="text-2xl font-black text-slate-800">{data.redWordCount || 0}</div>
        </div>
        <span className="text-sm font-black text-slate-300">VS</span>
        <div className={`flex-1 rounded-xl p-3 border-2 ${blueWon ? 'border-team-blue bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
          <div className="text-xs font-bold text-blue-600 uppercase mb-1">Blue</div>
          <div className="text-2xl font-black text-slate-800">{data.blueWordCount || 0}</div>
        </div>
      </div>

      <p className="text-sm font-bold text-slate-500">
        {tie ? 'Tie round!' : `${redWon ? 'Red' : 'Blue'} team wins this round!`}
      </p>

      {data.scores && (
        <div className="mt-4 space-y-1">
          {data.scores.map(s => (
            <div key={s.userId} className="flex items-center justify-between text-xs px-3 py-1.5 rounded-lg bg-slate-50">
              <span className={`font-bold ${s.team === 'red' ? 'text-red-600' : s.team === 'blue' ? 'text-blue-600' : 'text-slate-600'}`}>{s.username}</span>
              <span className="font-mono font-black text-accent-purple">{s.score}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-center gap-2 text-slate-400">
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-xs font-bold">Next round starting...</span>
      </div>
    </div>
  );
}

// ─── Dual Game Over ────────────────────────────────────
function DualGameOver({ data, onBack, myTeam }) {
  const { playSFX } = useSFXHook();
  const isRedWin = data.winnerTeam === 'red';
  const isTie = data.winnerTeam === 'tie';
  const myTeamWon = !isTie && data.winnerTeam === myTeam;

  useEffect(() => {
    playSFX(myTeamWon ? 'victory' : 'defeat');
  }, [myTeamWon, playSFX]);

  return (
    <div className="max-w-md mx-auto panel-3d p-8 bg-white text-center animate-fade-in">
      <h1 className="text-3xl font-black text-slate-800 uppercase mb-2">Game Over</h1>

      {isTie ? (
        <p className="text-xl font-black text-slate-500 mb-4">It's a Tie!</p>
      ) : (
        <p className={`text-xl font-black mb-4 ${isRedWin ? 'text-team-red' : 'text-team-blue'}`}>
          {isRedWin ? 'Red' : 'Blue'} Team Wins!
        </p>
      )}

      <div className="flex items-center justify-center gap-6 mb-6">
        <div className={`text-center px-6 py-3 rounded-xl border-2 ${isRedWin ? 'border-team-red bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
          <div className="text-xs font-bold text-red-500 uppercase">Red</div>
          <div className="text-3xl font-black text-slate-800">{data.redTotal}</div>
          <div className="text-xs text-slate-400">{data.redWordCount || 0} words</div>
        </div>
        <div className={`text-center px-6 py-3 rounded-xl border-2 ${!isRedWin && !isTie ? 'border-team-blue bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
          <div className="text-xs font-bold text-blue-500 uppercase">Blue</div>
          <div className="text-3xl font-black text-slate-800">{data.blueTotal}</div>
          <div className="text-xs text-slate-400">{data.blueWordCount || 0} words</div>
        </div>
      </div>

      {data.finalScores && (
        <div className="space-y-1 mb-6">
          {data.finalScores.map(s => (
            <div key={s.userId} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-slate-50">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-400">#{s.rank}</span>
                <span className={`font-bold ${s.team === 'red' ? 'text-red-600' : 'text-blue-600'}`}>{s.username}</span>
              </div>
              <span className="font-mono font-black text-accent-purple">{s.score}</span>
            </div>
          ))}
        </div>
      )}

      <Button size="lg" onClick={onBack} fullWidth>Back to Lobby</Button>
    </div>
  );
}

// ─── Standard Waiting Room ─────────────────────────────
function StandardWaitingRoom({ roomState, activePlayers, playersWithScores, isHost, code, copied, copyCode, handleStartGame, startError }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2 animate-fade-in flex flex-col gap-6">
        <div className="panel-3d p-6 bg-white">
          <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-4">
            <div>
              <h1 className="text-2xl font-black text-slate-800 mb-1 uppercase">Waiting Room</h1>
              <span className="text-xs font-bold text-slate-500 px-2 py-1 bg-slate-100 rounded-lg border border-slate-200">
                {roomState?.roundCount} rounds · {roomState?.drawTimeSecs}s draw time
              </span>
            </div>
            <div className="text-right bg-accent-purple/10 border-2 border-purple-200 px-4 py-2 rounded-xl">
              <p className="text-3xl font-black text-accent-purple">{activePlayers.length}</p>
              <p className="text-xs font-bold text-purple-400">/ {roomState?.maxPlayers}</p>
            </div>
          </div>
          <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden border border-slate-300">
            <div className="h-full bg-accent-yellow transition-all duration-500"
              style={{ width: `${(activePlayers.length / (roomState?.maxPlayers || 8)) * 100}%` }} />
          </div>
        </div>

        <div className="panel-3d p-8 text-center bg-white">
          <h2 className="text-2xl font-black text-slate-800 mb-3">
            {activePlayers.length < 2 ? 'Waiting for players...' : 'Ready to start!'}
          </h2>
          <p className="text-sm font-bold text-slate-500 mb-6">
            Share code <span className="font-mono font-black text-accent-purple bg-purple-100 px-3 py-1 rounded-lg border border-purple-200">{code?.toUpperCase()}</span>
          </p>
          <div className="flex justify-center mb-6">
            <Button variant="secondary" onClick={copyCode} size="md">
              {copied ? 'Copied!' : 'Copy Room Code'}
            </Button>
          </div>

          {isHost && activePlayers.length >= 2 && (
            <div className="pt-6 border-t-2 border-dashed border-slate-100 mt-4">
              <Button size="lg" onClick={handleStartGame} className="animate-pulse-glow">
                Start Game
              </Button>
              {startError && <p className="text-xs font-bold text-accent-red mt-2">{startError}</p>}
            </div>
          )}

          {!isHost && activePlayers.length >= 2 && (
            <p className="text-sm font-bold text-slate-400 mt-4">Waiting for host to start...</p>
          )}
        </div>
      </div>

      <div className="animate-fade-in panel-3d p-4 bg-slate-50" style={{ animationDelay: '0.15s' }}>
        <h3 className="text-sm font-black text-slate-800 mb-3 uppercase border-b-2 border-slate-200 pb-2">
          Players ({activePlayers.length})
        </h3>
        <div className="flex flex-col gap-2">
          {playersWithScores.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-4">No players yet...</p>
          )}
          {playersWithScores.map((player) => (
            <MiniPlayerCard key={player.userId} player={player} hostId={roomState?.hostUserId} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Compact Player Card (fits 12 in view) ────────────
function MiniPlayerCard({ player, hostId }) {
  const avatarColors = [
    'from-accent-purple to-accent-cyan',
    'from-accent-pink to-accent-orange',
    'from-accent-green to-accent-cyan',
    'from-accent-orange to-accent-red',
    'from-accent-purple to-accent-pink',
  ];
  const colorIndex = player.username
    ? player.username.charCodeAt(0) % avatarColors.length
    : 0;

  const teamBorder = player.team === 'red'
    ? 'border-l-team-red'
    : player.team === 'blue'
      ? 'border-l-team-blue'
      : '';

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 ${teamBorder} border-l-4 ${!player.isConnected ? 'opacity-40' : ''}`}>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black text-white flex-shrink-0 bg-gradient-to-br ${avatarColors[colorIndex]}`}>
        {player.username?.charAt(0).toUpperCase() || '?'}
      </div>
      <span className="text-xs font-bold text-slate-700 truncate flex-1">{player.username}</span>
      {player.userId === hostId && (
        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-accent-yellow text-white rounded border border-yellow-600">H</span>
      )}
      {!player.isConnected && (
        <span className="text-[9px] font-black uppercase text-slate-400">OFF</span>
      )}
      <span className="text-[10px] font-mono font-black text-accent-purple">{(player.score || 0).toLocaleString()}</span>
    </div>
  );
}
