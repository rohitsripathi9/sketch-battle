import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import Button from '../components/Button';

export default function Profile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api(`/api/users/${id}`)
      .then(data => setProfile(data.user))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <svg className="animate-spin h-10 w-10 text-accent-purple" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white border-4 border-slate-200 shadow-[0_6px_0_#cbd5e1] p-8 rounded-3xl text-center max-w-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-2">Player not found</h2>
          <Button onClick={() => navigate('/lobby')}>Back to Lobby</Button>
        </div>
      </div>
    );
  }

  const winRate = profile.gamesPlayed > 0
    ? ((profile.gamesWon / profile.gamesPlayed) * 100).toFixed(1)
    : 0;

  const stats = [
    {
      label: 'Total Score', value: parseInt(profile.totalScore).toLocaleString(),
      iconSvg: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>,
    },
    {
      label: 'Games Played', value: profile.gamesPlayed,
      iconSvg: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    {
      label: 'Games Won', value: profile.gamesWon,
      iconSvg: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    {
      label: 'Win Rate', value: `${winRate}%`,
      iconSvg: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b-4 border-slate-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-10 lg:px-16 py-5 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Button>
          <h1 className="text-lg font-extrabold text-slate-800">Profile</h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-10 lg:px-16 py-12 animate-fade-in">
        <div className="bg-white rounded-3xl p-10 text-center mb-8 border-4 border-slate-200 shadow-[0_6px_0_#cbd5e1]">
          <div className="w-20 h-20 rounded-full bg-accent-purple flex items-center justify-center text-3xl font-bold text-white mx-auto mb-4 shadow-lg">
            {profile.username?.charAt(0).toUpperCase()}
          </div>
          <h2 className="text-2xl font-extrabold text-slate-800">{profile.username}</h2>
          <p className="text-sm text-slate-500 mt-1">
            Member since {new Date(profile.createdAt).toLocaleDateString()}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-5">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl p-7 text-center border-4 border-slate-200 shadow-[0_4px_0_#cbd5e1]">
              <div className="flex justify-center text-accent-purple mb-3">{stat.iconSvg}</div>
              <div className="text-xl font-extrabold text-slate-800">{stat.value}</div>
              <div className="text-xs text-slate-500 mt-2">{stat.label}</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
