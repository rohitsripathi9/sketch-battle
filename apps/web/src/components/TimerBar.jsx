import { useTimer } from '../hooks/useTimer';

export default function TimerBar({ timerEndMs }) {
  const { seconds, fraction, isLow } = useTimer(timerEndMs);

  if (!timerEndMs) return null;

  return (
    <span className={`text-xs font-mono font-black border-2 px-2 py-0.5 rounded-lg shadow-sm ${isLow ? 'bg-red-500 text-white border-red-600 animate-pulse' : 'bg-white text-slate-700 border-slate-200'}`}>
      {seconds}s
    </span>
  );
}
