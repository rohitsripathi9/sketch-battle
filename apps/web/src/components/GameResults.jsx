import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSFX } from '../context/SFXContext';
import Button from './Button';

export default function GameResults({ results, onBackToLobby }) {
  const { user } = useAuth();
  const { playSFX } = useSFX();

  useEffect(() => {
    if (!results) return;
    const isWinner = results.winnerId === user?.id;
    playSFX(isWinner ? 'victory' : 'defeat');
  }, [results, user?.id, playSFX]);

  if (!results) return null;

  const { finalScores, winnerId } = results;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl border-4 border-slate-200 shadow-[0_8px_0_#cbd5e1] p-10 max-w-md w-full animate-fade-in">
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-yellow-50 border-4 border-yellow-300 flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <h2 className="text-3xl font-black text-slate-800">Game Over</h2>
        </div>

        <div className="flex flex-col gap-4 mb-10">
          {finalScores?.map((player, i) => (
            <div
              key={player.userId}
              className={`
                flex items-center gap-4 p-4 rounded-2xl border-4 transition-all
                ${i === 0
                  ? 'bg-yellow-50 border-yellow-300 shadow-[0_4px_0_#fbbf24]'
                  : i === 1
                    ? 'bg-slate-50 border-slate-300 shadow-[0_3px_0_#cbd5e1]'
                    : i === 2
                      ? 'bg-orange-50 border-orange-200 shadow-[0_3px_0_#fed7aa]'
                      : 'bg-slate-50 border-slate-200 shadow-[0_2px_0_#e2e8f0]'
                }
              `}
            >
              <span className={`
                w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-white
                ${i === 0 ? 'bg-accent-yellow border-2 border-yellow-600' : i === 1 ? 'bg-slate-400 border-2 border-slate-500' : i === 2 ? 'bg-amber-600 border-2 border-amber-700' : 'bg-slate-300 border-2 border-slate-400'}
              `}>
                #{i + 1}
              </span>
              <div className="flex-1">
                <p className="text-base font-black text-slate-800">{player.username}</p>
              </div>
              <span className="text-base font-mono font-black text-accent-purple bg-purple-50 px-3 py-1.5 rounded-xl border-2 border-purple-200">
                {player.score?.toLocaleString()} pts
              </span>
            </div>
          ))}
        </div>

        <Button onClick={onBackToLobby} fullWidth size="lg">
          Back to Lobby
        </Button>
      </div>
    </div>
  );
}
