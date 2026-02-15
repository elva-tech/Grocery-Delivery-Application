import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { APP_CONFIG } from '../../config/appConfig';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (login({ email, password })) {
      setError('');
      navigate('/');
    } else {
      setError('Invalid credentials. Use admin@test.com / admin123');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full border border-gray-100">
        
        {/* Header (OLD STRUCTURE) */}
        <div className="text-center mb-8">
          <div className="bg-primary-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <img
              src={APP_CONFIG.brand.logo}
              alt="FreshRoot"
              className="w-10 h-10"
            />
          </div>

          <h2 className="text-3xl font-bold text-gray-900">
            {APP_CONFIG.brand.name}
          </h2>
          <p className="text-gray-600 mt-2">
            {APP_CONFIG.brand.tagline}
          </p>
        </div>

        {/* Form (OLD FLOW) */}
        <div onKeyPress={handleKeyPress}>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="
                w-full px-4 py-3
                border border-gray-300
                rounded-xl
                focus:outline-none focus:ring-2 focus:ring-primary-600
              "
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="
                w-full px-4 py-3
                border border-gray-300
                rounded-xl
                focus:outline-none focus:ring-2 focus:ring-primary-600
              "
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-danger-50 border border-danger-200 rounded-lg">
              <p className="text-danger-600 text-sm font-medium">
                {error}
              </p>
            </div>
          )}

          <button
            onClick={handleSubmit}
            className="
              w-full py-3 rounded-xl
              bg-primary-600 text-white
              font-bold
              hover:bg-primary-700
              transition
            "
          >
            Sign In
          </button>

          {/* Demo box (OLD STYLE) */}
          <div className="mt-6 p-4 bg-primary-50 rounded-lg border border-primary-200">
            <p className="text-sm text-primary-900 font-medium text-center">
              Demo Credentials
            </p>
            <p className="text-sm text-primary-700 text-center mt-1">
              User:{' '}
              <span className="font-mono font-bold">
                admin@test.com
              </span>{' '}
              | Pass:{' '}
              <span className="font-mono font-bold">
                admin123
              </span>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Login;
