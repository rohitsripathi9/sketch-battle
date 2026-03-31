import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useRive, Layout, Fit, Alignment } from '@rive-app/react-canvas';
import { useAuth } from '../context/AuthContext';
import { useMediaQuery } from '../hooks/useMediaQuery';
import Button from '../components/Button';
import Input from '../components/Input';

const RIVE_LAYOUT = new Layout({ fit: Fit.Cover, alignment: Alignment.Center });

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const { RiveComponent } = useRive({
    src: '/mad_scientist.riv',
    stateMachines: 'State Machine 1',
    layout: RIVE_LAYOUT,
    autoplay: true,
  });

  const isDesktop = useMediaQuery('(min-width: 768px)');

  function validate() {
    const errs = {};
    if (!username.trim()) errs.username = 'Username is required';
    else if (username.length > 32) errs.username = 'Max 32 characters';
    else if (username.length < 2) errs.username = 'Min 2 characters';

    if (!email.trim()) errs.email = 'Email is required';
    else if (!/^\S+@\S+\.\S+$/.test(email)) errs.email = 'Invalid email';

    if (!password) errs.password = 'Password is required';
    else if (password.length < 6) errs.password = 'Min 6 characters';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError('');
    if (!validate()) return;

    setLoading(true);
    try {
      await register(username.trim(), email.trim().toLowerCase(), password);
      navigate('/lobby');
    } catch (err) {
      setServerError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row overflow-hidden">
      {/* Left half — Rive Animation (desktop only) */}
      {isDesktop && (
        <div className="w-1/2 min-h-screen flex items-center justify-center bg-slate-100 border-r-4 border-slate-200 shadow-[inset_-8px_0_15px_-10px_rgba(0,0,0,0.1)] relative overflow-hidden">
          <div className="absolute inset-0 w-full h-full animate-fade-in">
            <RiveComponent className="w-full h-full object-cover" />
          </div>
        </div>
      )}

      {/* Right half — Sign-up Card */}
      <div className="w-full md:w-1/2 flex items-center justify-center px-4 md:px-8 py-4 min-h-screen">
        <div className="w-full max-w-md animate-fade-in" style={{ animationDelay: '0.1s' }}>
          {/* Mobile: Rive above card */}
          {!isDesktop && (
            <div className="flex flex-col items-center mb-6">
              <h1 className="text-3xl font-black text-slate-800 mb-2 drop-shadow-sm">SketchBattle</h1>
              <div style={{ width: 180, height: 180 }}>
                <RiveComponent />
              </div>
            </div>
          )}

          <div className="bg-white rounded-3xl px-6 sm:px-8 py-5 border-4 border-slate-200 shadow-[0_6px_0_#cbd5e1] relative">
            <h2 className="text-xl font-black text-slate-800 mb-1">Create account</h2>
            <p className="text-slate-500 text-sm mb-4 font-medium">Join SketchBattle and start drawing</p>

            {serverError && (
              <div className="mb-3 p-2 rounded-xl bg-accent-red/10 border border-accent-red/30 text-accent-red text-sm flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {serverError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-2">
              <Input
                id="register-username"
                label="Username"
                placeholder="CoolArtist42"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                error={errors.username}
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                }
              />

              <Input
                id="register-email"
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email}
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                }
              />

              <Input
                id="register-password"
                label="Password"
                type="password"
                placeholder="Min 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                }
              />

              <Button type="submit" fullWidth loading={loading} size="md" className="mt-2">
                Create Account
              </Button>
            </form>

            <p className="text-center mt-4 text-sm text-slate-500 font-medium">
              Already have an account?{' '}
              <Link to="/login" className="text-accent-purple hover:text-accent-cyan transition-colors font-bold">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
