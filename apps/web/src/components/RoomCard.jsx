import { useSFX } from '../context/SFXContext';

export default function RoomCard({ code, hostName, playerCount, maxPlayers, roundCount, drawTimeSecs, onClick }) {
  const isFull = playerCount >= maxPlayers;
  const { playSFX } = useSFX();

  return (
    <button
      onClick={(e) => { playSFX('click'); if (onClick) onClick(e); }}
      disabled={isFull}
      className={`
        w-full text-left p-7 rounded-2xl border-4 transition-all duration-150
        panel-3d btn-3d hover:-translate-y-1 group
        ${isFull
          ? 'opacity-60 cursor-not-allowed border-slate-300 shadow-[0_4px_0_#cbd5e1] bg-slate-100 grayscale'
          : 'cursor-pointer border-slate-200 bg-white hover:border-accent-purple hover:shadow-[0_6px_0_#8b5cf6]'
        }
      `}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black tracking-widest px-3 py-1 bg-purple-100 text-accent-purple border-2 border-purple-200 rounded-xl">
            {code}
          </span>
          {isFull && (
            <span className="text-xs font-black uppercase px-3 py-1 bg-red-100 text-accent-red border-2 border-red-200 rounded-xl">
              Full
            </span>
          )}
        </div>
        <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center text-slate-400 group-hover:bg-accent-yellow group-hover:text-white group-hover:border-yellow-500 transition-colors">
          <svg className="w-5 h-5 translate-x-px font-bold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>

      <p className="text-lg font-bold text-slate-800 mb-5 truncate">
        {hostName}'s Room
      </p>

      <div className="flex items-center gap-4 text-sm font-medium text-slate-500">
        <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border-2 border-slate-200">
          <svg className="w-4 h-4 text-accent-cyan" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
          </svg>
          <span className="text-slate-700 font-bold">{playerCount}/{maxPlayers}</span>
        </div>
        <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border-2 border-slate-200">
          <svg className="w-4 h-4 text-accent-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="text-slate-700 font-bold">{roundCount} Rnds</span>
        </div>
        <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border-2 border-slate-200">
          <svg className="w-4 h-4 text-accent-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-slate-700 font-bold">{drawTimeSecs}s</span>
        </div>
      </div>
    </button>
  );
}
