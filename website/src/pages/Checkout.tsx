import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, MapPin, ArrowLeft, Phone, Map, Loader2, Tag, X, CheckCircle2, Banknote, CreditCard } from 'lucide-react';
import type { RootState } from '../store/store';
import { logout } from '../store/slices/authSlice';
import { useCalculateCartMutation } from '../api/apiSlice';
import { placeOrderApi, validateCouponApi } from '../api/ordersApi';
import { buildDeliveryAddressPayload, formatAddressSummary } from '../utils/indiaPincode';
import { loadRazorpay } from '../utils/loadRazorpay';
import { createPaymentOrder, verifyPayment } from '../api/paymentApi';
import { useToast } from '../context/ToastContext';
import { WEB_COPY, customerFacingDeliveryUnavailable } from '../constants/copy';

const Checkout = ({ address, deliveryEligibility }: any) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { showToast } = useToast();
  const { items } = useSelector((state: RootState) => state.cart);
  const { user } = useSelector((state: RootState) => state.auth);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [bill, setBill] = useState({
    subtotal: 0,
    deliveryCharge: 0,
    grandTotal: 0,
    isFreeDelivery: false,
    discount: 0,
    saved: 0,
    amountToFree: 0,
  });

  // Payment method
  const [paymentMethod, setPaymentMethod] = useState<'ONLINE' | 'COD'>('ONLINE');

  // Coupon state
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountAmount: number; description: string } | null>(null);
  const [couponError, setCouponError] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  const [getCalculation] = useCalculateCartMutation();

  useEffect(() => {
    const fetchBill = async () => {
      try {
        const response = await getCalculation(items).unwrap();
        setBill(response);
      } catch (error) {
        console.error("Backend calculation failed", error);
      }
    };
    if (items.length > 0) fetchBill();
  }, [items, getCalculation]);

const handleApplyCoupon = async () => {
  if (!couponInput.trim()) return;
  setCouponError('');
  setIsApplyingCoupon(true);
  try {
    const result = await validateCouponApi(couponInput.trim(), bill.subtotal);
    setAppliedCoupon({ code: result.code, discountAmount: result.discountAmount, description: result.description });
    setCouponInput('');
  } catch (err: any) {
    setCouponError(err?.response?.data?.message || 'Invalid coupon code');
    setAppliedCoupon(null);
  } finally {
    setIsApplyingCoupon(false);
  }
};

const handleRemoveCoupon = () => {
  setAppliedCoupon(null);
  setCouponError('');
  setCouponInput('');
};

const couponDiscount = appliedCoupon?.discountAmount ?? 0;
const finalTotal = bill.grandTotal - couponDiscount;

const deliveryBlocksPay =
  Boolean(deliveryEligibility?.checking) ||
  deliveryEligibility?.eligible === false ||
  (deliveryEligibility?.eligible === null && Boolean(deliveryEligibility?.message?.trim()));

const handlePlaceOrder = async () => {
  if (items.length === 0) return;
  if (deliveryEligibility?.checking) {
    showToast('error', 'Checking delivery availability. Please wait.');
    return;
  }
  if (deliveryEligibility?.eligible === false) {
    showToast('error', WEB_COPY.delivery.checkoutBlockedToast);
    return;
  }
  if (deliveryEligibility?.eligible === null && deliveryEligibility?.message?.trim()) {
    showToast('error', WEB_COPY.delivery.verifyAddressToast);
    return;
  }
  setIsProcessing(true);

  const details = deliveryEligibility?.details as { mapLink?: string; map_link?: string } | null | undefined;
  const mapLinkFromEligibility =
    (typeof details?.mapLink === 'string' && details.mapLink.trim()) ||
    (typeof details?.map_link === 'string' && details.map_link.trim()) ||
    '';
  const orderPayload = {
    items: items.map(item => ({ productId: item.id, qty: item.quantity })),
    paymentMode: paymentMethod,
    deliveryAddress: {
      ...buildDeliveryAddressPayload(address || {}),
      addressUrl: mapLinkFromEligibility,
    },
    couponCode: appliedCoupon?.code ?? null,
  };

  try {
    if (paymentMethod === 'COD') {
      // COD: place order directly, skip Razorpay
      const order = await placeOrderApi(orderPayload);
      navigate('/success', { state: { fromCheckout: true, orderId: order.orderId, orderItems: items } });
      return;
    }

    // ONLINE: existing Razorpay flow
    const order = await placeOrderApi(orderPayload);

    const scriptLoaded = await loadRazorpay();
    if (!scriptLoaded) {
      showToast('error', 'Failed to load payment gateway. Please check your connection.');
      setIsProcessing(false);
      return;
    }

    const paymentData = await createPaymentOrder(order.orderId);

    const rawPhone: string = user?.phone || user?.phoneNumber || '';
    const contact = rawPhone.replace(/^\+91/, '').replace(/\s+/g, '').slice(-10);

    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID as string,
      amount: paymentData.amount,
      currency: paymentData.currency,
      order_id: paymentData.razorpay_order_id,
      prefill: {
        name: user?.name || '',
        email: user?.email || '',
        contact,
      },
      method: {
        upi: true,
        card: true,
        netbanking: true,
        wallet: true,
      },
      theme: { color: '#1e293b' },
      handler: async (response: any) => {
        try {
          const verification = await verifyPayment({
            order_id: order.orderId,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          if (verification.success) {
            navigate('/success', { state: { fromCheckout: true, orderId: order.orderId, orderItems: items } });
          } else {
            showToast('error', 'Payment verification failed. Please contact support.');
            setIsProcessing(false);
          }
        } catch (err) {
          console.error('Payment verification error:', err);
          showToast('error', 'Payment verification failed. Please contact support.');
          setIsProcessing(false);
        }
      },
    };

    const rzp = new (window as any).Razorpay(options);

    rzp.on('payment.failed', (response: any) => {
      console.error('Payment failed:', response);
      showToast('error', response?.error?.description || 'Payment failed. Please try again.');
      setIsProcessing(false);
    });

    rzp.open();
  } catch (error: any) {
    console.error('Order placement failed:', error);
    if (error?.response?.status === 401) {
      dispatch(logout());
      showToast('error', 'Your session has expired. Please log in again to place your order.');
      navigate('/', { replace: true });
    } else {
      showToast('error', error?.response?.data?.message || 'Failed to place order. Please try again.');
      setIsProcessing(false);
    }
  }
};

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-24 animate-in fade-in duration-500">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-400 hover:text-slate-600 mb-10 transition-colors">
          <ArrowLeft size={18} />
          <span className="text-[10px] font-black uppercase tracking-widest">Back</span>
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-8">
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Checkout.</h1>
            
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-[#4b6f9e] rounded-xl"><MapPin size={20} /></div>
                <h3 className="font-black text-sm uppercase tracking-widest text-slate-800">Delivery Address</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{address?.label || 'Home'}</p>
                  <p className="text-slate-700 font-bold text-lg leading-tight whitespace-pre-line">
                    {formatAddressSummary(address || {}) || 'No address selected'}
                  </p>
                </div>

                {address?.landmark ? (
                  <div className="flex items-center gap-2 text-slate-500">
                    <Map size={14} />
                    <p className="text-xs font-bold">Landmark: {address.landmark}</p>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-4 pt-2">
                  <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl text-slate-600">
                    <Phone size={14} />
                    <span className="text-xs font-black">{address?.phone || '+91 0000000000'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl sticky top-10">
              <h3 className="font-black text-sm uppercase tracking-widest text-slate-800 mb-8 text-center">Summary</h3>
              <div className="space-y-4 mb-8 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                {items.map(item => (
                  <div key={item.id} className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500">{item.quantity}x {item.name}</span>
                    <span className="text-xs font-black text-slate-800">₹{item.price * item.quantity}</span>
                  </div>
                ))}
              </div>
              
              <div className="border-t border-slate-100 pt-6 space-y-3 mb-8">
                <div className="flex justify-between text-xs font-bold text-slate-400">
                  <span>Subtotal</span>
                  <span>₹{bill.subtotal}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-green-500">
                  <span>Delivery</span>
                  <span>{bill.isFreeDelivery ? 'FREE' : `₹${bill.deliveryCharge}`}</span>
                </div>
                {bill.discount > 0 && (
                  <div className="flex justify-between text-xs font-bold text-emerald-500">
                    <span>Store Discount</span>
                    <span>-₹{bill.discount}</span>
                  </div>
                )}
                {couponDiscount > 0 && (
                  <div className="flex justify-between text-xs font-bold text-purple-600">
                    <span>Coupon ({appliedCoupon!.code})</span>
                    <span>-₹{couponDiscount}</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline pt-4 border-t border-slate-100">
                  <span className="font-black text-slate-900 uppercase text-xs">Total</span>
                  <span className="text-3xl font-black text-slate-900 tracking-tighter">₹{finalTotal}</span>
                </div>
              </div>

              {/* Coupon input */}
              <div className="mb-6">
                {appliedCoupon ? (
                  <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-purple-600" />
                      <div>
                        <p className="text-xs font-black text-purple-700 font-mono">{appliedCoupon.code}</p>
                        {appliedCoupon.description && (
                          <p className="text-[10px] text-purple-500 mt-0.5">{appliedCoupon.description}</p>
                        )}
                      </div>
                    </div>
                    <button onClick={handleRemoveCoupon} className="text-purple-400 hover:text-purple-700 transition-colors ml-2">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={couponInput}
                          onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponError(''); }}
                          onKeyDown={e => e.key === 'Enter' && handleApplyCoupon()}
                          placeholder="Coupon code"
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold uppercase focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 placeholder:normal-case placeholder:font-sans placeholder:font-normal"
                        />
                      </div>
                      <button
                        onClick={handleApplyCoupon}
                        disabled={isApplyingCoupon || !couponInput.trim()}
                        className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-purple-700 text-white text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isApplyingCoupon ? <Loader2 size={14} className="animate-spin" /> : 'Apply'}
                      </button>
                    </div>
                    {couponError && (
                      <p className="text-[10px] text-red-500 font-bold px-1">{couponError}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Payment Method Selector */}
              <div className="mb-6 space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Payment Method</p>
                <button
                  onClick={() => setPaymentMethod('ONLINE')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all ${
                    paymentMethod === 'ONLINE'
                      ? 'border-[#4b6f9e] bg-blue-50'
                      : 'border-slate-100 bg-white hover:border-slate-200'
                  }`}
                >
                  <CreditCard size={18} className={paymentMethod === 'ONLINE' ? 'text-[#4b6f9e]' : 'text-slate-400'} />
                  <div className="flex-1 text-left">
                    <p className={`text-xs font-black ${ paymentMethod === 'ONLINE' ? 'text-[#4b6f9e]' : 'text-slate-600'}`}>Online Payment</p>
                    <p className="text-[10px] text-slate-400">UPI, Cards, Net Banking</p>
                  </div>
                  {paymentMethod === 'ONLINE' && <CheckCircle2 size={16} className="text-[#4b6f9e]" />}
                </button>

                <button
                  onClick={() => setPaymentMethod('COD')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all ${
                    paymentMethod === 'COD'
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-slate-100 bg-white hover:border-slate-200'
                  }`}
                >
                  <Banknote size={18} className={paymentMethod === 'COD' ? 'text-emerald-600' : 'text-slate-400'} />
                  <div className="flex-1 text-left">
                    <p className={`text-xs font-black ${ paymentMethod === 'COD' ? 'text-emerald-700' : 'text-slate-600'}`}>Cash on Delivery</p>
                    <p className="text-[10px] text-slate-400">Pay when your order arrives</p>
                  </div>
                  {paymentMethod === 'COD' && <CheckCircle2 size={16} className="text-emerald-500" />}
                </button>
              </div>

              <button 
                onClick={handlePlaceOrder} 
                disabled={
                  isProcessing ||
                  items.length === 0 ||
                  deliveryBlocksPay
                } 
                className={`w-full text-white h-16 rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-3 disabled:bg-slate-200 disabled:cursor-not-allowed ${
                  paymentMethod === 'COD'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-[#1e293b] hover:bg-[#4b6f9e]'
                }`}
              >
                {isProcessing
                  ? <Loader2 className="animate-spin" size={20} />
                  : deliveryEligibility?.checking
                  ? 'Checking location...'
                  : deliveryEligibility?.eligible === false
                  ? 'Delivery Not Available'
                  : deliveryEligibility?.eligible === null && deliveryEligibility?.message?.trim()
                  ? 'Verify delivery address'
                  : paymentMethod === 'COD'
                  ? 'Place Order (COD)'
                  : 'Confirm & Pay'}
              </button>
              {!deliveryEligibility?.checking && deliveryEligibility?.eligible === false && (
                <p className="mt-3 text-xs font-bold text-red-600 text-center">
                  {customerFacingDeliveryUnavailable(deliveryEligibility?.message)}
                </p>
              )}
              {!deliveryEligibility?.checking && deliveryEligibility?.eligible === null && deliveryEligibility?.message?.trim() && (
                <p className="mt-3 text-xs font-bold text-amber-700 text-center leading-snug px-1">
                  {deliveryEligibility.message}
                </p>
              )}
              
              <div className="mt-6 flex items-center justify-center gap-2 text-[#94a3b8]">
                {paymentMethod === 'COD'
                  ? <><Banknote size={14} /><span className="text-[9px] font-black uppercase tracking-widest">Pay on Delivery</span></>
                  : <><ShieldCheck size={14} /><span className="text-[9px] font-black uppercase tracking-widest">Encrypted Payment</span></>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;