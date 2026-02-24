import React, { useState, useRef, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { X, Phone, User, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
import { setCredentials } from '../../store/slices/authSlice';
import { requestOtp } from '../../api/addresses';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LoginModal = ({ isOpen, onClose }: LoginModalProps) => {
  const dispatch = useDispatch();
  const [step, setStep] = useState<'register' | 'otp'>('register');
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '']);
  const [timer, setTimer] = useState(30);

  const otpInputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    let interval: any;
    if (step === 'otp' && timer > 0) {
      interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  if (!isOpen) return null;

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const indiaPhoneRegex = /^[6-9]\d{9}$/;
    if (!indiaPhoneRegex.test(phone) || name.length < 2) return;
    
    setLoading(true);
    await requestOtp(phone); 
    setLoading(false);
    setStep('otp');
  };

  const handleResendOtp = async () => {
    setLoading(true);
    await requestOtp(phone);
    setTimer(30);
    setOtp(['', '', '', '']);
    setLoading(false);
  };

  const handleOtpChange = (val: string, index: number) => {
    const numericValue = val.replace(/[^0-9]/g, '');
    const newOtp = [...otp];
    newOtp[index] = numericValue.slice(-1);
    setOtp(newOtp);

    if (numericValue && index < 3) {
      otpInputs.current[index + 1]?.focus();
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.join('').length !== 4) return;

    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1500)); 

    dispatch(setCredentials({
      user: {
        id: Math.random().toString(36).substr(2, 9),
        phone: phone, // Raw phone, let backend/slice handle display
        name: name,
      },
      token: "mock-session-token"
    }));

    setLoading(false);
    onClose();
    setStep('register');
    setOtp(['', '', '', '']);
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
            {step === 'register' ? <User size={36} strokeWidth={1.5} /> : <ShieldCheck size={36} strokeWidth={1.5} />}
          </div>

          <div className="text-center mb-10">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">
              {step === 'register' ? 'Create Account' : 'Verification'}
            </h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
              {step === 'register' 
                ? 'Join us to start shopping' 
                : `Enter code sent to ${phone}`}
            </p>
          </div>

          <form onSubmit={step === 'register' ? handleSendOtp : handleVerify} className="space-y-5">
            {step === 'register' ? (
              <>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                      type="text"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full h-16 bg-slate-50 border-2 border-slate-200 focus:border-[#4b6f9e] focus:bg-white rounded-2xl pl-12 pr-4 font-bold outline-none transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Mobile Number</label>
                  <input 
                    type="tel"
                    placeholder="Enter 10 digit number"
                    value={phone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      if (val.length <= 10) setPhone(val);
                    }}
                    className="w-full h-16 bg-slate-50 border-2 border-slate-200 focus:border-[#4b6f9e] focus:bg-white rounded-2xl px-6 text-lg font-black tracking-widest outline-none transition-all"
                    required
                  />
                </div>
              </>
            ) : (
              <div className="flex justify-between gap-3 py-4">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (otpInputs.current[idx] = el)}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(e.target.value, idx)}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
                        otpInputs.current[idx - 1]?.focus();
                      }
                    }}
                    className="w-16 h-20 bg-white border-2 border-slate-300 focus:border-[#4b6f9e] focus:ring-4 focus:ring-blue-50 rounded-2xl text-center text-3xl font-black outline-none transition-all shadow-sm text-slate-800"
                  />
                ))}
              </div>
            )}

            <button 
              disabled={loading || (step === 'register' && (phone.length !== 10 || name.length < 2))}
              className="w-full h-16 bg-[#4b6f9e] hover:bg-[#1e293b] disabled:bg-slate-200 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-blue-900/20 transition-all active:scale-95 mt-4"
            >
              {loading ? (
                <Loader2 size={24} className="animate-spin" />
              ) : (
                <>
                  {step === 'register' ? 'Continue' : 'Verify & Login'}
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>

          {step === 'otp' && (
            <div className="mt-8 text-center">
              <button 
                type="button"
                disabled={timer > 0 || loading}
                onClick={handleResendOtp}
                className={`text-xs font-black uppercase tracking-widest transition-colors ${timer > 0 ? 'text-slate-300' : 'text-[#4b6f9e] hover:text-[#1e293b]'}`}
              >
                {timer > 0 ? `Resend code in ${timer}s` : "Resend Code Now"}
              </button>
            </div>
          )}
        </div>

        <div className="bg-slate-50 p-6 text-center border-t border-slate-100 mt-4">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] leading-relaxed">
            Secured by 256-bit encryption • Premium Quality Assured
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;