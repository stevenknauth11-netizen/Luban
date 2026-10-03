'use client';

import { useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { LogIn, Loader2, AlertCircle, Cpu } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(
        authError.message === 'Invalid login credentials'
          ? 'Credenciales incorrectas. Verifica tu correo y contraseña.'
          : authError.message
      );
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen">
      {/* Left Panel — Branding */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12"
        style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #CC0000 150%)',
        }}
      >
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
              <Cpu className="w-6 h-6 text-white" />
            </div>
            <span className="text-white/90 text-xl font-semibold tracking-tight">
              Taller Luban
            </span>
          </div>
          <p className="text-white/50 text-sm ml-[52px]">
            Centro de Innovación IoT Nicaragua-China
          </p>
        </div>

        <div className="space-y-6">
          <h1 className="text-white text-4xl font-bold leading-tight">
            Sistema de Inventariado
            <br />
            <span className="text-red-400">Inteligente</span>
          </h1>
          <p className="text-white/60 text-base max-w-md leading-relaxed">
            Plataforma ERP impulsada por estaciones de IA locales con hardware NEWLab.
            Detección automática de componentes electrónicos y gestión de stock en tiempo real.
          </p>
          <div className="flex gap-6 text-white/40 text-xs font-mono tracking-wider uppercase">
            <span>Keras / TensorFlow</span>
            <span>·</span>
            <span>STM32 + OV7725</span>
            <span>·</span>
            <span>PostgreSQL</span>
          </div>
        </div>

        <p className="text-white/30 text-xs">
          © {new Date().getFullYear()} Taller Luban · NEWLab · v1.0.0
        </p>
      </div>

      {/* Right Panel — Login Form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm space-y-8 animate-fadeIn">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <span className="text-slate-900 text-lg font-semibold">Taller Luban</span>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-slate-900">Iniciar Sesión</h2>
            <p className="text-sm text-slate-500 mt-1">
              Accede al panel de control del inventario
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-3 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Correo Electrónico
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operador@tallerluban.edu.ni"
                className="input-field"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-field"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full py-2.5"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              {loading ? 'Autenticando...' : 'Ingresar'}
            </button>
          </form>

          <p className="text-xs text-center text-slate-400 pt-4">
            Acceso restringido a personal autorizado del Taller Luban
          </p>
        </div>
      </div>
    </div>
  );
}
