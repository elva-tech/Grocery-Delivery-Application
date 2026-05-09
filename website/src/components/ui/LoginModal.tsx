import { useState, useRef, useEffect, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react';
import { useDispatch } from 'react-redux';
import { X, User, ShieldCheck, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { setCredentials } from '../../store/slices/authSlice';
import { sendOtp, verifyOtp } from '../../api/authApi';
import { getTenantId } from '../../utils/getTenantId';
import { WEB_COPY } from '../../constants/copy';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LoginModal = ({ isOpen, onClose }: LoginModalProps) => {
  const dispatch = useDispatch();
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [step, setStep] = useState<'auth' | 'otp'>('auth');
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(30);
  const [error, setError] = useState('');

  const otpInputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (step === 'otp' && timer > 0) {
      interval = setInterval(() => setTimer((prev: number) => prev - 1), 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [step, timer]);

  if (!isOpen) return null;

  const handleSendOtp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    
    const indiaPhoneRegex = /^[6-9]\d{9}$/;
    
    // Validate based on mode
    if (mode === 'signup' && name.length < 2) {
      setError('Please enter a valid name');
      return;
    }
    
    if (!indiaPhoneRegex.test(phone)) {
      setError('Please enter a valid 10-digit Indian phone number');
      return;
    }
    
    setLoading(true);
    try {
      const response = await sendOtp(phone);
      if (response.success) {
        setStep('otp');
      } else {
        setError(response.message || 'Failed to send OTP');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    setLoading(true);
    try {
      const response = await sendOtp(phone);
      if (response.success) {
        setTimer(30);
        setOtp(['', '', '', '', '', '']);
      } else {
        setError(response.message || 'Failed to resend OTP');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (val: string, index: number) => {
    const numericValue = val.replace(/[^0-9]/g, '');
    const newOtp = [...otp];
    newOtp[index] = numericValue.slice(-1);
    setOtp(newOtp);

    if (numericValue && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }
  };

  const handleVerify = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const response = await verifyOtp(phone, otpCode, mode === 'signup' ? name : undefined, mode);
      if (response.success && response.token) {
        const currentTenant = String(getTenantId() || '').trim().toLowerCase();
        const tokenTenant = String(response.user?.tenantId || '').trim().toLowerCase();
        if (currentTenant && tokenTenant && currentTenant !== tokenTenant) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('jwtToken');
          setError('You are logged into a different store tab. Please refresh and login again.');
          setLoading(false);
          return;
        }
        const userData = {
          id: response.user?.id || Math.random().toString(36).substr(2, 9),
          phone: response.user?.phoneNumber || phone,
          name: response.user?.name || 'User',
          tenantId: response.user?.tenantId || currentTenant,
        };
        // Store token and user data in localStorage for persistence
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(userData));
        // Remove any old 'jwtToken' key to avoid confusion
        localStorage.removeItem('jwtToken');
        dispatch(setCredentials({
          user: userData,
          token: response.token,
        }));

        onClose();
        setMode('signup');
        setStep('auth');
        setOtp(['', '', '', '', '', '']);
        setName('');
        setPhone('');
      } else {
        // Clear OTP fields on invalid OTP for fresh entry
        setOtp(['', '', '', '', '', '']);
        otpInputs.current[0]?.focus();
        const errorMessage = response.message || 'Invalid OTP. Please try again.';
        setError(errorMessage);
        
        // Auto-switch to login if trying to signup with existing account
        if (mode === 'signup' && errorMessage.includes('already registered')) {
          setTimeout(() => switchMode('login'), 1500);
        }
        
        // Auto-switch to signup if trying to login with non-existent account
        if (mode === 'login' && errorMessage.includes('not registered')) {
          setTimeout(() => switchMode('signup'), 1500);
        }
      }
    } catch (err) {
      // Clear OTP fields on error for fresh entry
      setOtp(['', '', '', '', '', '']);
      otpInputs.current[0]?.focus();
      const errorMessage = err instanceof Error ? err.message : 'Failed to verify OTP. Please try again.';
      setError(errorMessage);
      
      // Auto-switch to signup if trying to login with non-existent account
      if (mode === 'login' && errorMessage.includes("doesn't have an account")) {
        setTimeout(() => switchMode('signup'), 1500);
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: 'signup' | 'login') => {
    setMode(newMode);
    setStep('auth');
    setName('');
    setPhone('');
    setOtp(['', '', '', '', '', '']);
    setError('');
    setTimer(30);
  };


  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
      
      <div className="relative w-full max-w-[440px] bg-white rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-500">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full transition-colors z-10">
          <X size={20} className="text-slate-400" />
        </button>

        <div className="p-8 pt-12">
          <div className="w-20 h-20 bg-blue-50 text-[#4b6f9e] rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
            {step === 'auth' ? <User size={36} strokeWidth={1.5} /> : <ShieldCheck size={36} strokeWidth={1.5} />}
          </div>

          <div className="text-center mb-10">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">
              {step === 'auth' 
                    ? (mode === 'signup' ? 'Create Account' : 'Welcome Back')
                    : 'OTP Verification'}
            </h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
              {step === 'auth'
                ? (mode === 'signup' ? WEB_COPY.login.signupHint : WEB_COPY.login.signinHint)
                : `Enter code sent to ${phone}`}
            </p>
          </div>

          <form onSubmit={step === 'auth' ? handleSendOtp : handleVerify} className="space-y-5">
            {error && (
              <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex gap-3">
                <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-700">{error}</p>
                  {mode === 'login' && error.includes('not registered') && (
                    <button
                      type="button"
                      onClick={() => switchMode('signup')}
                      className="mt-2 text-xs font-black text-red-600 hover:text-red-800 underline"
                    >
                      → Create New Account
                    </button>
                  )}
                  {mode === 'signup' && error.includes('already registered') && (
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="mt-2 text-xs font-black text-red-600 hover:text-red-800 underline"
                    >
                      → Login with Existing Account
                    </button>
                  )}
                </div>
              </div>
            )}
            
            {step === 'auth' ? (
              <>
                {mode === 'signup' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                      <input 
                        type="text"
                        placeholder="John Doe"
                        value={name}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                        className="w-full h-16 bg-slate-50 border-2 border-slate-200 focus:border-[#4b6f9e] focus:bg-white rounded-2xl pl-12 pr-4 font-bold outline-none transition-all"
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Mobile Number</label>
                  <input 
                    type="tel"
                    placeholder={WEB_COPY.login.mobilePlaceholder}
                    value={phone}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      const val = e.target.value.replace(/\D/g, '');
                      if (val.length <= 10) setPhone(val);
                    }}
                    className="w-full h-16 bg-slate-50 border-2 border-slate-200 focus:border-[#4b6f9e] focus:bg-white rounded-2xl px-6 text-lg font-black tracking-widest outline-none transition-all"
                    required
                  />
                </div>
              </>
            ) : (
              <div className="flex justify-center gap-2 py-4">
                {otp.map((digit: string, idx: number) => (
                  <input
                    key={idx}
                    ref={(el: HTMLInputElement | null) => {
                      otpInputs.current[idx] = el;
                    }}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => handleOtpChange(e.target.value, idx)}
                    onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
                        otpInputs.current[idx - 1]?.focus();
                      }
                    }}
                    className="w-12 h-16 bg-white border-2 border-slate-300 focus:border-[#4b6f9e] focus:ring-4 focus:ring-blue-50 rounded-xl text-center text-2xl font-black outline-none transition-all shadow-sm text-slate-800"
                  />
                ))}
              </div>
            )}

            <button 
              disabled={loading || (step === 'auth' && (phone.length !== 10 || (mode === 'signup' && name.length < 2)))}
              className="w-full h-16 bg-[#4b6f9e] hover:bg-[#1e293b] disabled:bg-slate-200 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-blue-900/20 transition-all active:scale-95 mt-4"
            >
              {loading ? (
                <Loader2 size={24} className="animate-spin" />
              ) : (
                <>
                  {step === 'auth'
                    ? WEB_COPY.login.sendOtp
                    : (mode === 'signup' ? WEB_COPY.login.verifyContinue : WEB_COPY.login.verifySignIn)}
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>

          {step === 'auth' && (
            <div className="mt-6 text-center">
              <p className="text-xs text-slate-600 font-semibold mb-3">
                {mode === 'signup' 
                  ? 'Already have an account?'
                  : 'New user?'}
              </p>
              <button
                type="button"
                onClick={() => switchMode(mode === 'signup' ? 'login' : 'signup')}
                className="text-[#4b6f9e] hover:text-[#1e293b] font-black text-sm uppercase tracking-widest transition-colors"
              >
                {mode === 'signup' ? WEB_COPY.login.signIn : WEB_COPY.login.signUp}
              </button>
            </div>
          )}

          {step === 'otp' && (
            <div className="mt-8 space-y-4 text-center">
              <button 
                type="button"
                disabled={timer > 0 || loading}
                onClick={handleResendOtp}
                className={`text-xs font-black uppercase tracking-widest transition-colors ${timer > 0 ? 'text-slate-300' : 'text-[#4b6f9e] hover:text-[#1e293b]'}`}
              >
                {timer > 0 ? `Resend code in ${timer}s` : "Resend Code Now"}
              </button>
              <div className="border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => switchMode(mode === 'signup' ? 'login' : 'signup')}
                  className="text-[#4b6f9e] hover:text-[#1e293b] font-black text-xs uppercase tracking-widest transition-colors"
                >
                  {mode === 'signup' ? WEB_COPY.login.backToSignIn : WEB_COPY.login.backToSignUp}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-50 p-6 text-center border-t border-slate-100 mt-4">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] leading-relaxed">
            {WEB_COPY.login.securityFooter}
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;