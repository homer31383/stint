import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Fleuron } from './Ink';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) setError(err.message);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="fj-wordmark text-3xl flex items-center justify-center gap-2">
            Stint Ledger
            <Fleuron className="text-sagelabel" />
          </h1>
          <p className="hand fj-desk-text text-xl mt-1" style={{ transform: 'rotate(-2deg)' }}>
            the field journal
          </p>
        </div>

        <form onSubmit={handleSubmit} className="paper paper-2 paper-pad space-y-4">
          <div className="washi washi-kraft" />
          <div>
            <label className="mono-label block mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mono-label block mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-3 py-2 text-sm"
            />
          </div>

          {error && <div className="callout callout-bad text-sm">{error}</div>}

          <div className="flex justify-center pt-1">
            <button type="submit" disabled={loading} className="seal" title="Sign in">
              {loading ? 'signing in' : 'sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
