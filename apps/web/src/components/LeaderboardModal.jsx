import { useEffect, useState } from 'react';
import { apiGetLeaderboard } from '../lib/api';
import Button from './Button';

export default function LeaderboardModal({ onClose }) {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGetLeaderboard()
      .then(res => {
        setLeaders(res.leaderboard || []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to load leaderboard');
        setLoading(false);
      });
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-lg bg-white rounded-3xl p-6 lg:p-8 panel-3d animate-scale-up z-10 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-accent-yellow border-4 border-yellow-600 rounded-xl flex items-center justify-center shadow-inner">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
              </svg>
            </div>
            <h2 className="text-2xl font-black text-slate-800 uppercase drop-shadow-sm border-b-4 border-slate-200 pb-1">Leaderboard</h2>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-slate-100 border-2 border-slate-300 text-slate-500 hover:text-accent-red hover:border-red-300 hover:bg-red-50 flex items-center justify-center transition-colors active:translate-y-0.5 active:shadow-none shadow-[0_3px_0_#cbd5e1]"
          >
            <svg className="w-5 h-5 font-bold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] gap-4">
            <svg className="animate-spin h-10 w-10 text-accent-yellow" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="6" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-slate-500 font-bold">Loading legends...</p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] text-center gap-3">
             <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center text-red-500 scale-[-1] border-2 border-red-200">
               <span className="font-black text-3xl">!</span>
             </div>
             <p className="text-accent-red font-bold text-lg">{error}</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin">
            <div className="flex flex-col gap-2">
              {leaders.map((u, i) => (
                <div key={u.id} className="flex flex-col">
                  {i < 3 ? (
                    <div className={`flex items-center gap-4 px-4 py-3 rounded-2xl border-4 ${i===0 ? 'bg-amber-100 border-amber-300' : i===1 ? 'bg-slate-200 border-slate-300' : 'bg-orange-100 border-orange-300'} shadow-sm`}>
                      <span className={`text-xl font-black ${i===0?'text-amber-600':i===1?'text-slate-500':'text-orange-600'} w-6 text-center shadow-text-sm`}>#{i+1}</span>
                      <span className="flex-1 font-bold text-slate-800 text-lg">{u.username}</span>
                      <div className="text-right">
                        <p className="font-black text-amber-600 text-lg leading-tight">{Number(u.totalScore).toLocaleString()} XP</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-tight">{u.gamesPlayed} games played</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 px-3 py-2 border-b-2 border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                      <span className="text-sm font-black text-slate-400 w-6 text-center">#{i+1}</span>
                      <span className="flex-1 font-bold text-slate-700">{u.username}</span>
                      <span className="font-mono font-black text-slate-600 text-sm">{Number(u.totalScore).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              ))}
              {leaders.length === 0 && (
                <p className="text-slate-500 text-center py-10 font-bold">No players on the board yet!</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
