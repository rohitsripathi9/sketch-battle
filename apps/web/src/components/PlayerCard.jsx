export default function PlayerCard({ username, score = 0, team, isConnected = true, isHost = false }) {
  const teamColors = {
    red: 'border-team-red bg-red-50 shadow-[0_4px_0_#ef4444]',
    blue: 'border-team-blue bg-blue-50 shadow-[0_4px_0_#3b82f6]',
    none: 'border-slate-300 bg-white shadow-[0_4px_0_#cbd5e1]',
  };

  const avatarColors = [
    'from-accent-purple to-accent-cyan',
    'from-accent-pink to-accent-orange',
    'from-accent-green to-accent-cyan',
    'from-accent-orange to-accent-red',
    'from-accent-purple to-accent-pink',
  ];

  // Deterministic color from username
  const colorIndex = username
    ? username.charCodeAt(0) % avatarColors.length
    : 0;

  return (
    <div
      className={`
        flex items-center gap-3 p-2 rounded-xl border-2 transition-all duration-200 panel-3d
        ${teamColors[team || 'none']}
        ${!isConnected ? 'opacity-50 grayscale' : 'hover:-translate-y-0.5 hover:brightness-105 cursor-pointer'}
      `}
    >
      {/* Avatar */}
      <div
        className={`
          w-8 h-8 rounded-lg border border-white flex items-center justify-center
          text-sm font-black text-white flex-shrink-0 shadow-[0_1px_0_rgba(0,0,0,0.1)]
          bg-gradient-to-br rotate-[-3deg]
          ${avatarColors[colorIndex]}
          ${!isConnected ? 'grayscale' : ''}
        `}
      >
        {username?.charAt(0).toUpperCase() || '?'}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold truncate ${team === 'red' ? 'text-red-800' : team === 'blue' ? 'text-blue-800' : 'text-slate-800'}`}>
            {username}
          </span>
          {isHost && (
            <span className="px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest bg-accent-yellow border border-yellow-600 shadow-[0_1px_0_#ca8a04] text-white rounded">
              Host
            </span>
          )}
          {!isConnected && (
            <span className="px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest bg-slate-300 border border-slate-400 text-slate-600 shadow-[0_1px_0_#94a3b8] rounded">
              Offline
            </span>
          )}
        </div>
        <div className="text-xs font-bold text-slate-500 -mt-0.5">
          {score.toLocaleString()} pts
        </div>
      </div>

      {/* Team indicator */}
      {team && team !== 'none' && (
        <div
          className={`
            w-1.5 h-6 rounded-full flex-shrink-0
            ${team === 'red' ? 'bg-team-red' : 'bg-team-blue'}
          `}
        />
      )}
    </div>
  );
}
