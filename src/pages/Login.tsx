import { useState } from 'react';
import { Mail, Lock, ShieldAlert, XCircle, ArrowLeft } from 'lucide-react';

interface LoginProps {
  onLogin: (user: { id: string; name: string; email: string; role: 'admin' | 'manager' | 'employee'; avatar: string }) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [step, setStep] = useState<'landing' | 'form'>('landing');
  const [email, setEmail] = useState('gabriel@novelus.com');
  const [password, setPassword] = useState('admin');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    if (password !== 'admin') {
      setError('Invalid credentials.');
      return;
    }

    setLoading(true);
    try {
      const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1').replace(/\/+$/, '');
      const response = await fetch(`${baseUrl}/employees/dev-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (!response.ok) {
        throw new Error('Invalid credentials.');
      }
      const data = await response.json();
      onLogin(data);
    } catch (err) {
      setError('Invalid credentials.');
    } finally {
      setLoading(false);
    }
  }

  function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotSubmitted(true);
    setTimeout(() => {
      setForgotSubmitted(false);
      setForgotOpen(false);
      setForgotEmail('');
    }, 2500);
  }

  function fillCredentials(mail: string) {
    setEmail(mail);
    setPassword('admin');
  }

  return (
    <div className="relative min-h-screen w-full bg-[#020813] flex items-center justify-center overflow-hidden px-4">
      {/* ── Background Clean Wireframe Mesh ── */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-all duration-700 opacity-60"
        style={{ backgroundImage: "url('/login_bg.png')" }}
      ></div>

      {/* Grid lines overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b1a_1px,transparent_1px),linear-gradient(to_bottom,#1e293b1a_1px,transparent_1px)] bg-[size:4rem_4rem] z-0"></div>

      {/* Glow shapes */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] animate-pulse delay-1000"></div>

      {/* ── Login Container ── */}
      <div className="relative z-10 w-full max-w-sm min-h-[460px] flex items-center justify-center">
        
        {/* Step 1: Landing screen */}
        <div
          className={`absolute flex flex-col items-center text-center transition-all duration-500 transform ${
            step === 'landing' ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'
          }`}
        >
          {/* Logo with green-dot branding */}
          <div className="mb-10 select-none drop-shadow-[0_0_30px_rgba(150,193,60,0.35)]">
            <svg viewBox="0 0 260 54" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-14 w-auto mx-auto">
              <text x="0" y="42" fill="white" fontSize="44" fontWeight="900" letterSpacing="2" style={{fontFamily:"'Arial Black',Arial,sans-serif",fontWeight:900}}>N</text>
              <circle cx="60" cy="27" r="12" fill="#96C13C" />
              <text x="80" y="42" fill="white" fontSize="44" fontWeight="900" letterSpacing="2" style={{fontFamily:"'Arial Black',Arial,sans-serif",fontWeight:900}}>VELUS</text>
            </svg>
          </div>

          <button
            onClick={() => setStep('form')}
            className="bg-[#00a8e8] hover:bg-[#0096d1] text-white font-bold px-12 py-4 rounded-xl text-sm tracking-widest shadow-[0_0_20px_rgba(0,168,232,0.4)] hover:shadow-[0_0_30px_rgba(0,168,232,0.6)] active:scale-95 transition-all duration-200 cursor-pointer"
          >
            LOGIN
          </button>
        </div>

        {/* Step 2: Access Portal Card */}
        <div
          className={`w-full bg-[#0a1526]/80 backdrop-blur-xl border border-cyan-500/30 p-8 rounded-2xl shadow-[0_0_40px_rgba(6,182,212,0.15)] flex flex-col items-center relative transition-all duration-500 transform ${
            step === 'form' ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4 pointer-events-none'
          }`}
        >
          {/* Back button */}
          <button
            onClick={() => {
              setStep('landing');
              setError('');
            }}
            className="absolute top-6 left-6 text-slate-500 hover:text-white transition-colors cursor-pointer"
            title="Go Back"
          >
            <ArrowLeft size={16} />
          </button>

          {/* Heading with green-dot logo */}
          <div className="mb-1">
            <svg viewBox="0 0 260 54" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-9 w-auto mx-auto drop-shadow-[0_0_12px_rgba(150,193,60,0.4)]">
              <text x="0" y="42" fill="white" fontSize="44" fontWeight="900" letterSpacing="2" style={{fontFamily:"'Arial Black',Arial,sans-serif",fontWeight:900}}>N</text>
              <circle cx="60" cy="27" r="12" fill="#96C13C" />
              <text x="80" y="42" fill="white" fontSize="44" fontWeight="900" letterSpacing="2" style={{fontFamily:"'Arial Black',Arial,sans-serif",fontWeight:900}}>VELUS</text>
            </svg>
          </div>
          <p className="text-slate-400 text-xs tracking-wider mt-1 mb-8">Access Portal</p>

          {error && (
            <div className="w-full bg-red-950/40 border border-red-800/80 rounded-xl p-3 flex items-center gap-2 text-red-200 text-xs mb-4">
              <ShieldAlert size={14} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">
            {/* Username Input */}
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                placeholder="Username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-[#070e1b] border border-cyan-500/20 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]"
              />
            </div>

            {/* Password Input */}
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-[#070e1b] border border-cyan-500/20 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]"
              />
            </div>

            {/* LOGIN Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-3.5 rounded-xl text-sm tracking-widest shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:shadow-[0_0_25px_rgba(6,182,212,0.5)] active:scale-98 transition-all duration-150 cursor-pointer flex items-center justify-center mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                'LOGIN'
              )}
            </button>
          </form>

          {/* Links */}
          <div className="flex flex-col items-center gap-2 mt-6">
            <button
              onClick={() => setForgotOpen(true)}
              className="text-xs text-slate-400 hover:text-cyan-400 transition-colors"
            >
              Forgot Password?
            </button>
            <button
              onClick={() => setError('Contact HR at admin@novelus.com for credentials.')}
              className="text-xs text-slate-400 hover:text-cyan-400 transition-colors"
            >
              Request Access
            </button>
          </div>

          {/* Tip banner */}
          <div className="mt-6 text-[10px] text-slate-500 border-t border-slate-800/60 pt-4 w-full text-center space-y-1.5">
            <p className="text-slate-400 font-bold mb-1">Click below to auto-fill:</p>
            <div onClick={() => fillCredentials('gabriel@novelus.com')} className="cursor-pointer hover:bg-slate-800/40 p-1.5 rounded transition-all border border-slate-800/40">
              💡 <strong>Employee</strong>: <span className="font-mono text-cyan-400 underline">gabriel@novelus.com</span>
            </div>
            <div onClick={() => fillCredentials('maram@novelus.com')} className="cursor-pointer hover:bg-slate-800/40 p-1.5 rounded transition-all border border-slate-800/40">
              💼 <strong>Manager</strong>: <span className="font-mono text-cyan-400 underline">maram@novelus.com</span>
            </div>
            <div onClick={() => fillCredentials('admin@novelus.com')} className="cursor-pointer hover:bg-slate-800/40 p-1.5 rounded transition-all border border-slate-800/40">
              🛡️ <strong>HR Admin</strong>: <span className="font-mono text-cyan-400 underline">admin@novelus.com</span>
            </div>
          </div>
        </div>

      </div>

      {/* Forgot Password Modal */}
      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl relative">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Reset Password</h3>
              <button onClick={() => setForgotOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <XCircle size={18} />
              </button>
            </div>

            {forgotSubmitted ? (
              <div className="text-center py-6">
                <span className="text-3xl">📧</span>
                <p className="text-white font-semibold text-sm mt-2">Recovery Email Sent!</p>
                <p className="text-slate-400 text-xs mt-1">Please check your inbox shortly.</p>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="flex flex-col gap-4">
                <p className="text-xs text-slate-400">Enter your email and we'll send you a password reset link.</p>
                <input
                  type="email"
                  required
                  placeholder="Enter email address"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none"
                />
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Send Reset Link
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
export { XCircle };
