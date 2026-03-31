import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Join() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      sessionStorage.setItem('pendingRoom', code?.toUpperCase() || '');
      navigate('/login');
    } else {
      navigate(`/room/${code?.toUpperCase()}`);
    }
  }, [loading, isAuthenticated, code, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <svg className="animate-spin h-10 w-10 text-accent-purple" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-slate-600">Joining room <span className="font-mono font-bold text-accent-purple">{code?.toUpperCase()}</span>...</p>
      </div>
    </div>
  );
}
