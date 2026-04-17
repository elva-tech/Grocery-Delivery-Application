import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { APP_CONFIG } from '../../config/appConfig';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/apiService';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState('phone'); // 'phone' or 'otp'
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    setError('');
    
    if (!phoneNumber || phoneNumber.length !== 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.sendOtp(phoneNumber);
      if (response.success) {
        setStep('otp');
      } else {
        setError(response.message || 'Failed to send OTP');
      }
    } catch (err) {
      console.error('Send OTP error:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to send OTP';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError('');
    
    if (!otp || otp.length < 6) {
      setError('Please enter a valid OTP');
      return;
    }

    setLoading(true);
    try {
      const result = await login(phoneNumber, otp);
      if (result.success) {
        navigate('/');
      } else {
        setError(result.message || 'Verification failed');
      }
    } catch (err) {
      console.error('Verify OTP error:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Verification failed';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      if (step === 'phone') {
        handleSendOtp();
      } else {
        handleVerifyOtp();
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full border border-gray-100">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="bg-primary-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <img src={APP_CONFIG.brand.logo} alt="FreshRoot" className="w-10 h-10" />
          </div>

          <h2 className="text-3xl font-bold text-gray-900">
            {APP_CONFIG.brand.name}
          </h2>
          <p className="text-gray-600 mt-2">
            Admin Portal
          </p>
        </div>

        {/* Form */}
        <div onKeyPress={handleKeyPress}>
          
          {step === 'phone' ? (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="10-digit phone number"
                  maxLength="10"
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
                onClick={handleSendOtp}
                disabled={loading}
                className="
                  w-full py-3 rounded-xl
                  bg-primary-600 text-white
                  font-bold
                  hover:bg-primary-700
                  transition
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
                {loading ? 'Sending...' : 'Send OTP'}
              </button>
            </>
          ) : (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Enter OTP
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="6-digit OTP"
                  maxLength="6"
                  className="
                    w-full px-4 py-3
                    border border-gray-300
                    rounded-xl
                    focus:outline-none focus:ring-2 focus:ring-primary-600
                    text-center text-2xl tracking-widest
                  "
                />
                <p className="text-xs text-gray-500 mt-2">
                  OTP sent to {phoneNumber}
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-danger-50 border border-danger-200 rounded-lg">
                  <p className="text-danger-600 text-sm font-medium">
                    {error}
                  </p>
                </div>
              )}

              <button
                onClick={handleVerifyOtp}
                disabled={loading}
                className="
                  w-full py-3 rounded-xl
                  bg-primary-600 text-white
                  font-bold
                  hover:bg-primary-700
                  transition
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
                {loading ? 'Verifying...' : 'Verify OTP'}
              </button>

              <button
                onClick={() => {
                  setStep('phone');
                  setOtp('');
                  setError('');
                }}
                className="
                  w-full py-2 mt-3 rounded-xl
                  bg-gray-100 text-gray-700
                  font-medium
                  hover:bg-gray-200
                  transition
                "
              >
                Change Number
              </button>
            </>
          )}

          {/* Demo box */}
          <div className="mt-6 p-4 bg-primary-50 rounded-lg border border-primary-200">
            <p className="text-sm text-primary-900 font-medium text-center">Demo Credentials</p>
            <p className="text-sm text-primary-700 text-center mt-1">
              Any 10-digit number | OTP:{' '}
              <span className="font-mono font-bold">123456</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;