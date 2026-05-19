import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { APP_CONFIG } from '../../config/appConfig';
import { useNavigate } from 'react-router-dom';
import { useTenantBranding } from '../../context/TenantBrandingContext';

const Login = () => {
  const { storeName, logo } = useTenantBranding();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError('');

    const trimmedId = identifier.trim();
    if (!trimmedId) {
      setError('Enter your store phone number or email');
      return;
    }

    const digits = trimmedId.replace(/\D/g, '');
    const isEmail = trimmedId.includes('@');
    if (!isEmail && digits.length !== 10) {
      setError('Enter a valid 10-digit phone number or email address');
      return;
    }

    if (!password) {
      setError('Password is required');
      return;
    }

    setLoading(true);
    try {
      const result = await login(trimmedId, password);
      if (result.success) {
        navigate('/');
      } else {
        setError(result.message || 'Sign in failed');
      }
    } catch (err) {
      console.error('Admin login error:', err);
      setError(
        err.response?.data?.message || err.message || 'Sign in failed'
      );
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full border border-gray-100">
        <div className="text-center mb-8">
          <div className="bg-primary-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 overflow-hidden">
            <img
              src={logo || APP_CONFIG.brand.logo}
              alt={storeName}
              className={logo ? 'w-10 h-10 object-cover rounded-lg' : 'w-10 h-10'}
            />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">{storeName}</h2>
          <p className="text-gray-600 mt-2">Admin Portal</p>
        </div>
        <div onKeyDown={onKeyDown}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone or email
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="10-digit mobile or store email"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-600"
              autoComplete="username"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password set by platform admin"
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-600"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-primary-600 font-medium"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          {error && (
            <div className="mb-4 p-3 bg-danger-50 border border-danger-200 rounded-lg">
              <p className="text-danger-600 text-sm font-medium">{error}</p>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-primary-600 text-white font-bold hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
          <div className="mt-6 p-4 bg-primary-50 rounded-lg border border-primary-200">
            <p className="text-sm text-primary-900 font-medium text-center">
              Store admin sign-in
            </p>
            <p className="text-xs text-primary-800 text-center mt-2 leading-relaxed">
              Use the <strong>phone or email</strong> from store setup and the{' '}
              <strong>password</strong> your platform admin set. Contact them to reset
              your password.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

