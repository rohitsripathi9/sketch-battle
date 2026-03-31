export default function DualBattleHUD({ players, scores, redWordCount = 0, blueWordCount = 0 }) {
  const redPlayers = players.filter(p => p.team === 'red');
  const bluePlayers = players.filter(p => p.team === 'blue');

  const redScore = redPlayers.reduce((sum, p) => sum + (p.score || 0), 0);
  const blueScore = bluePlayers.reduce((sum, p) => sum + (p.score || 0), 0);

  return (
    <div className="bg-white rounded-2xl p-4 border-4 border-slate-200 shadow-[0_4px_0_#cbd5e1]">
      <div className="flex items-stretch gap-2">
        {/* Red Team */}
        <div className="flex-1 rounded-lg border border-team-red/30 bg-team-red/5 p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-team-red" />
            <span className="text-xs font-bold text-team-red uppercase tracking-wider">Red Team</span>
          </div>
          <div className="text-2xl font-extrabold text-slate-800">{redScore}</div>
          <div className="text-xs text-slate-500 mt-0.5">{redWordCount} words guessed</div>
          <div className="mt-2 flex flex-col gap-1">
            {redPlayers.map(p => (
              <div key={p.userId} className="text-xs text-slate-600 flex items-center gap-1">
                <span className={p.isConnected ? 'text-slate-800' : 'text-slate-300'}>{p.username}</span>
                <span className="text-slate-400 ml-auto font-mono">{p.score || 0}</span>
              </div>
            ))}
          </div>
        </div>

        {/* VS */}
        <div className="flex items-center">
          <span className="text-xs font-bold text-slate-400 px-1">VS</span>
        </div>

        {/* Blue Team */}
        <div className="flex-1 rounded-lg border border-team-blue/30 bg-team-blue/5 p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-team-blue" />
            <span className="text-xs font-bold text-team-blue uppercase tracking-wider">Blue Team</span>
          </div>
          <div className="text-2xl font-extrabold text-slate-800">{blueScore}</div>
          <div className="text-xs text-slate-500 mt-0.5">{blueWordCount} words guessed</div>
          <div className="mt-2 flex flex-col gap-1">
            {bluePlayers.map(p => (
              <div key={p.userId} className="text-xs text-slate-600 flex items-center gap-1">
                <span className={p.isConnected ? 'text-slate-800' : 'text-slate-300'}>{p.username}</span>
                <span className="text-slate-400 ml-auto font-mono">{p.score || 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
