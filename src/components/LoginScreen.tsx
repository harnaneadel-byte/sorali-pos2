import React, { useState, useEffect } from 'react';
import { SolariLogo } from './SolariLogo';
import { Delete, AlertTriangle } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (user: any, token: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Load the user list for the profile dropdown
  useEffect(() => {
    fetch('/api/auth/users')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.users)) {
          setUsers(d.users);
          if (d.users.length > 0) setSelectedUserId(d.users[0].id);
        }
      })
      .catch(() => setError('Impossible de charger les utilisateurs.'));
  }, []);

  const submit = async (pinToTry: string) => {
    if (!selectedUserId || pinToTry.length !== 4) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selectedUserId, pin: pinToTry }),
      });
      const data = await res.json();
      if (data.success && data.token) {
        onLogin(data.user, data.token);
      } else {
        setError(data?.error?.message || 'Code PIN incorrect.');
        setPin('');
      }
    } catch {
      setError('Erreur de connexion au serveur.');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const pressKey = (k: string) => {
    if (loading) return;
    setError('');
    if (k === 'del') return setPin((p) => p.slice(0, -1));
    if (k === 'clear') return setPin('');
    const next = (pin + k).slice(0, 4);
    setPin(next);
    if (next.length === 4) setTimeout(() => submit(next), 150); // auto-submit
  };

  const selectedUser = users.find((u) => u.id === selectedUserId);
  const roleLabel = (r: string) =>
    r === 'admin' ? 'Administrateur' : r === 'manager' ? 'Manager' : 'Vendeur';

  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-stone-200 shadow-xl p-6 space-y-5">
        {/* Branding */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <SolariLogo size="md" showSubtitle={true} />
          </div>
          <h1 className="font-cinzel text-lg font-bold text-stone-900">Ouverture de Session</h1>
          <p className="text-xs text-stone-500">Sélectionnez votre profil et saisissez votre code PIN</p>
        </div>

        {/* Profile selector */}
        <div>
          <label className="block text-xs font-semibold text-stone-600 mb-1">Profil</label>
          <select
            value={selectedUserId}
            onChange={(e) => {
              setSelectedUserId(e.target.value);
              setPin('');
              setError('');
            }}
            className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2.5 text-sm font-medium text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} — {roleLabel(u.role)}
              </option>
            ))}
          </select>
        </div>

        {/* PIN dots */}
        <div className="flex justify-center gap-3 py-1">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-3.5 h-3.5 rounded-full border-2 transition ${
                i < pin.length ? 'bg-amber-600 border-amber-600' : 'bg-stone-100 border-stone-300'
              }`}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* PIN pad */}
        <div className="grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'del'].map((k) => (
            <button
              key={k}
              onClick={() => pressKey(k)}
              disabled={loading}
              className={`h-12 rounded-xl text-lg font-bold transition active:scale-95 ${
                k === 'del' || k === 'clear'
                  ? 'bg-stone-100 text-stone-500 hover:bg-stone-200 text-sm'
                  : 'bg-stone-50 text-stone-800 hover:bg-amber-50 border border-stone-200'
              } ${loading ? 'opacity-50' : ''}`}
            >
              {k === 'del' ? <Delete className="w-5 h-5 mx-auto" /> : k === 'clear' ? 'C' : k}
            </button>
          ))}
        </div>

        <div className="text-center text-[11px] text-stone-400">
          {loading
            ? 'Vérification...'
            : selectedUser
            ? `Connexion en tant que ${selectedUser.name}`
            : 'Sélectionnez un profil'}
        </div>
      </div>
    </div>
  );
};