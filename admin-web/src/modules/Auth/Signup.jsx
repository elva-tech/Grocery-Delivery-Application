import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { APP_CONFIG } from '../../config/appConfig';
import { useNavigate, Link } from 'react-router-dom';
import { useTenantBranding } from '../../context/TenantBrandingContext';

const Signup = () => {
  const { storeName, logo } = useTenantBranding();
  const { signup } = useAuth();
  const navigate = useNavigate();
  
  // States
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = () => {
    // Basic Validation
    if (!name || !email || !password) {
      setError('Please fill in all fields');
      return;
    }

    // Security Check
    if (adminKey !== 'ELVA-2024-ADMIN') {
      setError('Invalid Admin Secret Key');
      return;
    }

    const res = signup({ name, email, password });
    
    if (res.success) {
      setError('');
      setSuccess(true);
      // Brief delay so they see the success message before redirect
      setTimeout(() => navigate('/login'), 2000);
    } else {
      setError(res.msg);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };


  //TENANT BRANDING IN LOGIN SCREEN
  const cached = JSON.parse(localStorage.getItem("tenant_branding") || "{}");
const finalLogo = logo || cached.logo || APP_CONFIG.brand.logo;
const finalName = storeName || cached.storeName || "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full border border-gray-100">
        
        {/* Header (MATCHING LOGIN) */}
        <div className="text-center mb-8">
          <div className="bg-primary-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 overflow-hidden">
            <img
              src={finalLogo}
              alt={finalName}
              className={logo ? 'w-10 h-10 object-cover rounded-lg' : 'w-10 h-10'}
            />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Create Account</h2>
          <p className="text-gray-600 mt-2">{finalName && <>Join the {finalName} team</>}</p>
        </div>

        <div onKeyPress={handleKeyPress}>
          {/* Full Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="Enter your full name" 
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-600" 
            />
          </div>

          {/* Email */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="Enter your email" 
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-600" 
            />
          </div>

          {/* Password */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="Create a password" 
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-600" 
            />
          </div>

          {/* Admin Secret Key (Security Field) */}
         <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Admin Secret Key</label>
            <input 
              type="text" 
              value={adminKey} 
              onChange={(e) => setAdminKey(e.target.value)} 
              placeholder="Enter master registration key" 
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-600 bg-slate-50 font-mono text-sm" 
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-danger-50 border border-danger-200 rounded-lg">
              <p className="text-danger-600 text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-600 text-sm font-medium">Account created! Redirecting to login...</p>
            </div>
          )}

          <button 
            onClick={handleSubmit} 
            className="w-full py-3 rounded-xl bg-primary-600 text-white font-bold hover:bg-primary-700 transition"
          >
            Register Admin
          </button>

          <div className="mt-6 text-center">
             <p className="text-sm text-gray-500">
               Already have an account? <Link to="/login" className="text-primary-600 font-bold hover:underline">Sign In</Link>
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;