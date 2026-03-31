import { useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useRive, useStateMachineInput, Layout, Fit, Alignment } from '@rive-app/react-canvas';
import { useAuth } from '../context/AuthContext';
import { useMediaQuery } from '../hooks/useMediaQuery';
import Button from '../components/Button';
import Input from '../components/Input';

const STATE_MACHINE = 'State Machine 1';
const RIVE_LAYOUT = new Layout({ fit: Fit.Cover, alignment: Alignment.Center });

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const { login, loginAsGuest } = useAuth();
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const { rive, RiveComponent } = useRive({
    src: '/mad_scientist.riv',
    stateMachines: STATE_MACHINE,
    layout: RIVE_LAYOUT,
    autoplay: true,
  });

  const checkingTrigger = useStateMachineInput(rive, STATE_MACHINE, 'Checking');
  const successTrigger = useStateMachineInput(rive, STATE_MACHINE, 'Success');
  const failTrigger = useStateMachineInput(rive, STATE_MACHINE, 'Fail');

  const fireOutcome = useCallback((succeeded) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (succeeded) {
          successTrigger?.fire();
        } else {
          failTrigger?.fire();
        }
        setTimeout(resolve, 2500); // Wait 2.5s for success animation to finish
      }, 1500);
    });
  }, [successTrigger, failTrigger]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    checkingTrigger?.fire();

    let succeeded = false;
    try {
      await login(email, password);
      succeeded = true;
    } catch (err) {
      setError(err.message || 'Login failed');
    }

    await fireOutcome(succeeded);
    setLoading(false);
    if (succeeded) navigateRef.current('/lobby');
  }

  async function handleGuest() {
    setError('');
    setGuestLoading(true);
    checkingTrigger?.fire();

    let succeeded = false;
    try {
      await loginAsGuest();
      succeeded = true;
    } catch (err) {
      setError(err.message || 'Guest login failed');
    }

    await fireOutcome(succeeded);
    setGuestLoading(false);
    if (succeeded) navigateRef.current('/lobby');
  }

  const isDesktop = useMediaQuery('(min-width: 768px)');

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

      {/* Right half — Sign-in Card */}
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

          <div className="bg-white rounded-3xl px-6 sm:px-8 py-6 border-4 border-slate-200 shadow-[0_6px_0_#cbd5e1] relative">
            <h2 className="text-xl font-black text-slate-800 mb-1">Welcome back</h2>
            <p className="text-slate-500 text-sm mb-4 font-medium">Sign in to start drawing</p>

            {error && (
              <div className="mb-3 p-2 rounded-xl bg-accent-red/10 border border-accent-red/30 text-accent-red text-sm flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <Input
                id="login-email"
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                }
              />

              <Input
                id="login-password"
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                }
              />

              <Button type="submit" fullWidth loading={loading} size="md" className="mt-1">
                Sign In
              </Button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-4 my-3">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400 uppercase tracking-widest font-black">or</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {/* Guest */}
            <Button
              variant="secondary"
              fullWidth
              onClick={handleGuest}
              loading={guestLoading}
              size="md"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Play as Guest
            </Button>

            <p className="text-center mt-3 text-sm text-slate-500 font-medium">
              Don't have an account?{' '}
              <Link to="/register" className="text-accent-purple hover:text-accent-cyan transition-colors font-bold">
                Sign up
              </Link>
            </p>
          </div>

          <p className="text-center mt-3 text-xs text-slate-400">
            By playing, you agree to have fun.
          </p>
        </div>
      </div>
    </div>
  );
}
