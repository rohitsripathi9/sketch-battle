import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiGetPublicRooms, apiCreateRoom } from '../lib/api';
import Button from '../components/Button';
import Input from '../components/Input';
import Modal from '../components/Modal';
import GameModeCard from '../components/GameModeCard';
import RoomCard from '../components/RoomCard';
import LeaderboardModal from '../components/LeaderboardModal';
import { useSFX } from '../context/SFXContext';

const GAME_MODES = [
  {
    mode: 'matchmaking',
    title: 'Online Match',
    image: '/play_online.png',
    lottie: '/Game Boost.lottie',
    playerInfo: '2-8 players',
  },
  {
    mode: 'dual_battle',
    title: '2v2 Battle',
    image: '/2v2.png',
    lottie: '/PA22.lottie',
    playerInfo: '4 players (2v2)',
  },
  {
    mode: 'private',
    title: 'Private Room',
    image: '/private.png',
    lottie: '/Unlocked.lottie',
    playerInfo: '2-12 players',
  },
];

export default function Lobby() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [selectedMode, setSelectedMode] = useState('matchmaking');
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [error, setError] = useState('');
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const { isMuted, toggleMute, playSFX } = useSFX();

  // Room creation settings
  const [settings, setSettings] = useState({
    maxPlayers: 8,
    roundCount: 3,
    drawTimeSecs: 80,
    password: '',
  });

  const fetchRooms = useCallback(async () => {
    try {
      const data = await apiGetPublicRooms();
      setRooms(data.rooms || []);
    } catch {
      // Silently fail — circuit breaker in api.js prevents flooding
    } finally {
      setRoomsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
    // Poll every 8s (not 5s) to reduce load; circuit breaker handles server-down
    const interval = setInterval(fetchRooms, 8000);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  async function handleCreateRoom() {
    setCreateLoading(true);
    setError('');

    try {
      const isDual = selectedMode === 'dual_battle';
      const data = await apiCreateRoom({
        mode: selectedMode,
        maxPlayers: isDual ? 4 : settings.maxPlayers,
        roundCount: settings.roundCount,
        drawTimeSecs: isDual ? 60 : settings.drawTimeSecs,
        password: selectedMode === 'private' ? settings.password : null,
      });
      setShowCreateModal(false);
      navigate(`/room/${data.room.code}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreateLoading(false);
    }
  }

  function handleJoinByCode(e) {
    e.preventDefault();
    if (joinCode.trim().length >= 4) {
      navigate(`/room/${joinCode.trim().toUpperCase()}`);
    }
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-accent-cyan border-b-8 border-cyan-600 shadow-md">
        <div className="max-w-7xl mx-auto px-8 lg:px-12 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-yellow border-4 border-yellow-600 flex items-center justify-center shadow-[0_3px_0_#ca8a04]">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <span className="text-xl font-black text-white drop-shadow-[0_2px_0_rgba(0,0,0,0.15)] hidden sm:block">
              SketchBattle
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border-4 border-slate-200 shadow-[0_3px_0_#cbd5e1]">
              <div className="w-7 h-7 rounded-lg bg-accent-purple border-2 border-purple-600 flex items-center justify-center text-xs font-black text-white">
                {user?.username?.charAt(0).toUpperCase()}
              </div>
              <p className="text-sm font-bold text-slate-800 hidden sm:block">{user?.username}</p>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLeaderboard(true)}
              className="text-white hover:bg-black/20 hover:text-white rounded-xl px-3"
              title="Leaderboard"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleMute}
              className="text-white hover:bg-black/20 hover:text-white rounded-xl px-3"
              title={isMuted ? "Unmute SFX" : "Mute SFX"}
            >
              {isMuted ? (
                <svg className="w-5 h-5 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              )}
            </Button>

            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-white hover:bg-black/20 hover:text-white rounded-xl" title="Logout">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 lg:px-16 py-12">
        {/* Game Modes — centered row */}
        <section className="mb-14">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 lg:gap-10">
            {GAME_MODES.map((gm) => (
              <GameModeCard
                key={gm.mode}
                {...gm}
                selected={selectedMode === gm.mode}
                onClick={() => setSelectedMode(gm.mode)}
              />
            ))}
          </div>
        </section>

        {/* Actions row — Create + Join */}
        <section className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-16">
          <Button
            size="lg"
            onClick={() => setShowCreateModal(true)}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create Room
          </Button>
          <form onSubmit={handleJoinByCode} className="flex gap-3 w-full sm:w-auto">
            <Input
              id="join-code"
              placeholder="Enter Code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              className="w-48"
            />
            <Button type="submit" variant="secondary" disabled={joinCode.trim().length < 4}>
              Join
            </Button>
          </form>
        </section>

        {/* Public Rooms */}
        {selectedMode === 'matchmaking' && (
          <section>
            <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-black text-slate-800 uppercase">Public Rooms</h2>
              <p className="text-sm font-medium text-slate-400 mt-1">{rooms.length} available</p>
            </div>
            <Button variant="ghost" size="sm" onClick={fetchRooms} className="border-2 border-slate-300 bg-slate-100 hover:bg-slate-200 shadow-[0_3px_0_#cbd5e1] active:translate-y-1 active:shadow-none">
              <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </Button>
          </div>

          {roomsLoading ? (
            <div className="flex items-center justify-center py-16">
              <svg className="animate-spin h-8 w-8 text-accent-purple" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : rooms.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {rooms.map((room) => (
                <RoomCard
                  key={room.id}
                  {...room}
                  onClick={() => navigate(`/room/${room.code}`)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 bg-white border-4 border-slate-200 rounded-2xl shadow-[0_4px_0_#cbd5e1]">
              <p className="text-base font-bold text-slate-400 mb-4">No rooms yet</p>
              <Button size="md" onClick={() => setShowCreateModal(true)}>
                Create Room
              </Button>
            </div>
          )}
        </section>
        )}
      </main>

      {showLeaderboard && (
        <LeaderboardModal onClose={() => setShowLeaderboard(false)} />
      )}

      {/* Create Room Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Room"
        size="md"
      >
        <div className="flex flex-col gap-4">
          {/* Selected mode summary */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-purple-50 border-4 border-purple-200">
            <img
              src={GAME_MODES.find(m => m.mode === selectedMode)?.image}
              alt=""
              className="w-10 h-10 object-contain"
            />
            <div>
              <p className="text-base font-black text-purple-900">
                {GAME_MODES.find(m => m.mode === selectedMode)?.title}
              </p>
              <p className="text-xs font-bold text-purple-600">
                {GAME_MODES.find(m => m.mode === selectedMode)?.playerInfo}
              </p>
            </div>
          </div>

          {/* Settings */}
          {selectedMode === 'dual_battle' ? (
            <div className="space-y-3">
              <div className="bg-slate-100 rounded-xl p-3 border-2 border-slate-200 space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-slate-600">Players</span>
                  <span className="font-black text-slate-800">4 (2v2)</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-slate-600">Draw Time</span>
                  <span className="font-black text-slate-800">60s per round</span>
                </div>
              </div>
              <div>
                <label className="text-sm font-bold text-slate-700 mb-1 block">Rounds</label>
                <select
                  value={settings.roundCount}
                  onChange={(e) => setSettings(s => ({ ...s, roundCount: Number(e.target.value) }))}
                  className="w-full bg-slate-100 border-4 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-accent-purple focus:bg-white transition-colors"
                >
                  {[1, 2, 3, 5, 7, 10].map(n => (
                    <option key={n} value={n}>{n} round{n > 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-bold text-slate-700 mb-1 block">Max Players</label>
                  <select
                    value={settings.maxPlayers}
                    onChange={(e) => setSettings(s => ({ ...s, maxPlayers: Number(e.target.value) }))}
                    className="w-full bg-slate-100 border-4 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-accent-purple focus:bg-white transition-colors"
                  >
                    {[2, 4, 6, 8, 10, 12].map(n => (
                      <option key={n} value={n}>{n} players</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-700 mb-1 block">Rounds</label>
                  <select
                    value={settings.roundCount}
                    onChange={(e) => setSettings(s => ({ ...s, roundCount: Number(e.target.value) }))}
                    className="w-full bg-slate-100 border-4 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-accent-purple focus:bg-white transition-colors"
                  >
                    {[1, 2, 3, 5, 7, 10].map(n => (
                      <option key={n} value={n}>{n} round{n > 1 ? 's' : ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-slate-700 mb-1 block">Draw Time</label>
                <div className="flex items-center gap-3 bg-slate-100 p-3 rounded-xl border-4 border-slate-200">
                  <input
                    type="range"
                    min={30}
                    max={180}
                    step={10}
                    value={settings.drawTimeSecs}
                    onChange={(e) => setSettings(s => ({ ...s, drawTimeSecs: Number(e.target.value) }))}
                    className="flex-1 accent-accent-purple h-1.5 bg-slate-300 rounded-full appearance-none outline-none"
                  />
                  <span className="text-sm font-black text-slate-800 w-12 text-center bg-white px-2 py-1 rounded-lg border-2 border-slate-200 shadow-sm">{settings.drawTimeSecs}s</span>
                </div>
              </div>
            </>
          )}

          {selectedMode === 'private' && (
            <div className="-mt-1">
              <Input
                id="room-password"
                label="Room Password"
                type="password"
                placeholder="Optional"
                value={settings.password}
                onChange={(e) => setSettings(s => ({ ...s, password: e.target.value }))}
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-accent-red -mt-2">{error}</p>
          )}

          <div className="flex gap-4 pt-3">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)} className="flex-1" size="md">
              Cancel
            </Button>
            <Button onClick={handleCreateRoom} loading={createLoading} className="flex-1" size="md">
              Create
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
