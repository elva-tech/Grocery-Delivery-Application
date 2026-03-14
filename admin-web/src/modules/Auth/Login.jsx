import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { APP_CONFIG } from '../../config/appConfig';
import { useNavigate, Link } from 'react-router-dom';
import Swal from 'sweetalert2'; // UN-COMMENTED

const Login = () => {
  const { login, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Form (OLD FLOW) logic preserved
  const handleSubmit = () => {
    const res = login({ email, password });
    if (res.success) {
      setError('');
      navigate('/');
    } else {
      setError(res.msg || 'Invalid credentials.');
    }
  };

  // PRODUCTION FORGOT PASSWORD FLOW
  const handleForgot = async () => {
    const { value: emailInput } = await Swal.fire({
      title: 'Reset Password',
      text: "Enter your admin email to reset access",
      input: 'email',
      inputPlaceholder: 'admin@test.com',
      confirmButtonColor: '#4b6f9e',
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value) return 'You need to write something!'
      }
    });

    if (emailInput) {
      const { value: newPass } = await Swal.fire({
        title: 'New Password',
        input: 'password',
        inputPlaceholder: 'Enter new secure password',
        confirmButtonColor: '#4b6f9e',
        showCancelButton: true,
        inputValidator: (value) => {
          if (!value) return 'Password cannot be empty!'
        }
      });
      
      if (newPass) {
        Swal.showLoading(); // Show "Backend" processing
        const res = await resetPassword(emailInput, newPass);
        
        if (res.success) {
          Swal.fire({
            icon: 'success',
            title: 'Updated!',
            text: 'Your password has been changed successfully.',
            confirmButtonColor: '#4b6f9e'
          });
        } else {
          Swal.fire('Error', res.msg, 'error');
        }
      }
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
            <img src={APP_CONFIG.brand.logo} alt="FreshRoot" className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">{APP_CONFIG.brand.name}</h2>
          <p className="text-gray-600 mt-2">{APP_CONFIG.brand.tagline}</p>
        </div>

        <div onKeyPress={handleKeyPress}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-600" />
          </div>

          <div className="mb-4">
            <div className="flex justify-between">
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <button type="button" onClick={handleForgot} className="text-xs text-primary-600 hover:underline">Forgot?</button>
            </div>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-600" />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-danger-50 border border-danger-200 rounded-lg">
              <p className="text-danger-600 text-sm font-medium">{error}</p>
            </div>
          )}

          <button onClick={handleSubmit} className="w-full py-3 rounded-xl bg-primary-600 text-white font-bold hover:bg-primary-700 transition">
            Sign In
          </button>

          <div className="mt-6 text-center">
             <p className="text-sm text-gray-500">
               New user? <Link to="/signup" className="text-primary-600 font-bold hover:underline">Create Account</Link>
             </p>
          </div>

          {/* Demo box (OLD STYLE) preserved */}
          <div className="mt-6 p-4 bg-primary-50 rounded-lg border border-primary-200">
            <p className="text-sm text-primary-900 font-medium text-center">Demo Credentials</p>
            <p className="text-sm text-primary-700 text-center mt-1">
              User: <span className="font-mono font-bold text-[10px]">admin@test.com</span> | Pass: <span className="font-mono font-bold text-[10px]">admin123</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;