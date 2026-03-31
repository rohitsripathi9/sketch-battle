export default function ScoreBoard({ players, currentDrawerUserId, correctGuessers }) {
  const sorted = [...players]
    .filter(p => p.role === 'player')
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  return (
    <div className="flex flex-col gap-1.5">
      {sorted.map((player, i) => {
        const isDrawing = player.userId === currentDrawerUserId;
        const hasGuessed = correctGuessers?.has(player.userId);

        return (
          <div
            key={player.userId}
            className={`
              flex items-center gap-2 py-1.5 text-xs transition-all border-b border-slate-100 last:border-0
              ${!player.isConnected ? 'opacity-40' : ''}
            `}
          >
            <span className="w-4 text-center text-[10px] font-black text-slate-400">
              #{i + 1}
            </span>
            <div className={`
              w-6 h-6 rounded flex items-center justify-center text-[10px] font-black text-white flex-shrink-0
              ${isDrawing ? 'bg-accent-purple' : hasGuessed ? 'bg-accent-green' : 'bg-slate-400'}
            `}>
              {player.username?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-bold text-slate-800 truncate block text-xs">
                {player.username}
              </span>
            </div>
            {isDrawing && (
              <span className="text-[9px] font-black text-accent-purple tracking-widest uppercase">
                Drawing
              </span>
            )}
            {hasGuessed && !isDrawing && (
              <svg className="w-3.5 h-3.5 text-accent-green flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
            <span className="text-[10px] font-mono font-black text-accent-purple w-10 text-right">
              {(player.score || 0).toLocaleString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}
