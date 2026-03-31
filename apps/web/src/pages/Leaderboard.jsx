import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGetLeaderboard } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    apiGetLeaderboard()
      .then(data => setLeaderboard(data.leaderboard || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const rankLabels = ['1st', '2nd', '3rd'];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b-4 border-slate-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-10 lg:px-16 py-5 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/lobby')}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Lobby
          </Button>
          <h1 className="text-lg font-extrabold text-slate-800">Leaderboard</h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-10 lg:px-16 py-12">
        {loading ? (
          <div className="flex justify-center py-20">
            <svg className="animate-spin h-8 w-8 text-accent-purple" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border-4 border-slate-200 shadow-[0_6px_0_#cbd5e1]">
            <div className="flex justify-center mb-4">
              <svg className="w-10 h-10 text-accent-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-2">No scores yet</h2>
            <p className="text-sm text-slate-500">Play some games to appear here</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 animate-fade-in">
            {leaderboard.map((entry) => {
              const isMe = entry.id === user?.id;
              return (
                <div
                  key={entry.id}
                  className={`
                    flex items-center gap-5 p-6 rounded-2xl transition-all cursor-pointer border-4
                    ${isMe
                      ? 'bg-purple-50 border-purple-200 shadow-[0_4px_0_#c4b5fd]'
                      : 'bg-white border-slate-200 shadow-[0_4px_0_#cbd5e1] hover:border-purple-200'
                    }
                  `}
                  onClick={() => navigate(`/profile/${entry.id}`)}
                >
                  <span className={`w-10 text-center font-black ${entry.rank <= 3 ? 'text-lg text-accent-purple' : 'text-slate-400'}`}>
                    {entry.rank <= 3 ? rankLabels[entry.rank - 1] : `#${entry.rank}`}
                  </span>
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0
                    ${entry.rank === 1 ? 'bg-gradient-to-br from-accent-orange to-accent-red' : 'bg-slate-400'}
                  `}>
                    {entry.username?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold truncate ${isMe ? 'text-accent-purple' : 'text-slate-800'}`}>
                      {entry.username} {isMe && <span className="text-xs text-slate-400">(you)</span>}
                    </p>
                    <p className="text-xs text-slate-500">
                      {entry.gamesPlayed} games · {entry.gamesWon} wins
                    </p>
                  </div>
                  <span className="text-sm font-mono font-bold text-accent-purple">
                    {parseInt(entry.totalScore).toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
