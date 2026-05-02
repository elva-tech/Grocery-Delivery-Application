import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Package, Clock, AlertCircle, RotateCcw, X, Loader2, PartyPopper, AlertTriangle, CheckCircle2, Star } from 'lucide-react';
import type { RootState } from '../store/store';
import { getUserOrders, cancelOrderApi, rateOrderApi, downloadOrderSummaryPdfApi } from '../api/ordersApi';
import { addToCart } from '../store/slices/cartSlice';
import { useNavigate, useLocation } from 'react-router-dom';
import ReportIssueModal from './ReportIssueModal';
import { useGetAppSettingsQuery } from '../api/apiSlice';
import { resolveImageUrl } from '../utils/resolveImageUrl';
import { useToast } from '../context/ToastContext';

const STATUS_THEME: any = {
  PLACED: { color: 'text-slate-500', bg: 'bg-slate-50', label: 'Order Placed' },
  CONFIRMED: { color: 'text-blue-600', bg: 'bg-blue-50', label: 'Confirmed' },
  OUT_FOR_DELIVERY: { color: 'text-amber-600', bg: 'bg-amber-50', label: 'On its way' },
  DELIVERED: { color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Delivered' },
  CANCELLED: { color: 'text-red-600', bg: 'bg-red-50', label: 'Cancelled' },
  ISSUE_REPORTED: { color: 'text-purple-600', bg: 'bg-purple-50', label: 'Issue Reported' },
  REFUND_APPROVED: { color: 'text-emerald-700', bg: 'bg-emerald-100', label: 'Refund Approved' },
  REFUND_REJECTED: { color: 'text-red-700', bg: 'bg-red-100', label: 'Refund Rejected' },
};

const Orders = ({ openCart }: { openCart: () => void }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { showToast } = useToast();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  
  // NEW: Fetch remote features
  const { data: settings } = useGetAppSettingsQuery();
  
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showSuccess, setShowSuccess] = useState(location.state?.fromCheckout || false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  // Rating state
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingOrderId, setRatingOrderId] = useState<string | null>(null);
  const [starValue, setStarValue] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [ratingError, setRatingError] = useState('');
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
        navigate('/');
        return;
    }
    loadOrders();
    if (location.state?.fromCheckout) {
      window.history.replaceState({}, document.title);
    }
  }, [isAuthenticated]);

const loadOrders = async () => {
  try {
    setLoading(true);

    const apiData = await getUserOrders();

    if (!apiData || !Array.isArray(apiData)) {
      throw new Error("Invalid order data");
    }

    setOrders(apiData);

    if (selectedOrder) {
      const updatedSelected = apiData.find((o: any) => o.id === selectedOrder.id);
      if (updatedSelected) setSelectedOrder(updatedSelected);
    } else if (location.state?.fromCheckout && apiData.length > 0) {
      setSelectedOrder(apiData[0]);
    }

  } catch (error) {
    console.error("Failed to load orders:", error);

    showToast('error', 'Failed to load orders. Please try again.');

    setOrders([]); // safe fallback
  } finally {
    setLoading(false);
  }
};

 const handleReorder = (items: any[]) => {
  items.forEach(item => {
    dispatch(addToCart({
      id: item.productId,          // ✅ FIX (cart id)
      productId: item.productId,   // ✅ IMPORTANT (backend use)
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      image: resolveImageUrl(item),
      imageUrl: item.imageUrl ?? item.image,
    }));
  });

  openCart();
};

 const handleCancelOrder = async () => {
  if (!selectedOrder) return;

  const res = await cancelOrderApi(selectedOrder.id);

  if (!res.success) {
    showToast('error', res.message || 'Cancel failed');
    return;
  }

  showToast('success', 'Order cancelled successfully');

  await loadOrders();        // ✅ reload
  setIsCancelModalOpen(false); // ✅ close modal
};
  const handleReportSuccess = async () => {
    await loadOrders();
    setIsReportModalOpen(false);
  };

  const openRatingModal = (orderId: string) => {
    setRatingOrderId(orderId);
    setStarValue(0);
    setRatingComment('');
    setRatingError('');
    setShowRatingModal(true);
  };

  const submitRating = async () => {
    if (starValue === 0) { setRatingError('Please select a star rating.'); return; }
    setIsSubmittingRating(true);
    setRatingError('');
    try {
      await rateOrderApi(ratingOrderId!, starValue, ratingComment);
      setShowRatingModal(false);
      await loadOrders();
      // Update selected panel if it was this order
      setSelectedOrder((prev: any) =>
        prev?.id === ratingOrderId ? { ...prev, rating: { value: starValue, comment: ratingComment, createdAt: new Date().toISOString() } } : prev
      );
    } catch (err: any) {
      setRatingError(err?.response?.data?.message || err?.message || 'Failed to submit rating.');
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleDownloadInvoice = async (orderId: string) => {
    try {
      setIsDownloadingInvoice(true);
      await downloadOrderSummaryPdfApi(orderId);
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || err?.message || 'Failed to download order summary.');
    } finally {
      setIsDownloadingInvoice(false);
    }
  };

  const sections = [
    { title: "On its way", data: orders.filter(o => o.status === 'OUT_FOR_DELIVERY') },
    { title: "Order Placed", data: orders.filter(o => ['PLACED', 'CONFIRMED'].includes(o.status)) },
    { title: "Delivered & Others", data: orders.filter(o => ['DELIVERED', 'ISSUE_REPORTED', 'REFUND_APPROVED', 'REFUND_REJECTED', 'CANCELLED'].includes(o.status)) }
  ];

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <Loader2 className="animate-spin text-[#4b6f9e] mb-4" size={40} />
      <p className="font-black text-slate-400 uppercase tracking-widest text-xs">Syncing History...</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 relative">
      {showSuccess && (
        <div className="mb-10 bg-emerald-50 border-2 border-emerald-100 p-6 rounded-[2rem] flex items-center justify-between animate-in slide-in-from-top-4">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-500 p-3 rounded-2xl text-white shadow-lg shadow-emerald-200">
              <PartyPopper size={24} />
            </div>
            <div>
              <h2 className="text-emerald-900 font-black text-xl tracking-tight">Order Successful!</h2>
              <p className="text-emerald-600 font-bold text-sm">Your fresh supplies are being packed.</p>
            </div>
          </div>
          <button onClick={() => setShowSuccess(false)} className="bg-white/50 p-2 rounded-full hover:bg-white text-emerald-900"><X size={18}/></button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className="md:col-span-5 space-y-8">
          <h1 className="text-3xl font-black text-slate-900 mb-6 px-2 italic uppercase tracking-tighter">Order History.</h1>
          
          {sections.map((section) => section.data.length > 0 && (
            <div key={section.title} className="space-y-4">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">{section.title}</h2>
              {section.data.map((order) => (
                <div 
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className={`group cursor-pointer p-6 rounded-[2rem] border-2 transition-all ${
                    selectedOrder?.id === order.id ? 'border-[#4b6f9e] bg-white shadow-xl translate-x-2' : 'border-transparent bg-white hover:border-slate-100 shadow-sm'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">#{order.id}</span>
                      <h3 className="font-black text-slate-800">
                        {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}
                      </h3>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${STATUS_THEME[order.status]?.bg} ${STATUS_THEME[order.status]?.color}`}>
                      {STATUS_THEME[order.status]?.label}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{order.items.length} Items</p>
                    <p className="font-black text-slate-900">₹{order.totalAmount}</p>
                  </div>
                  {/* Inline rating badge on card */}
                  {order.rating?.value && (
                    <div className="mt-3 flex items-center gap-1.5">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} size={12}
                          className={s <= order.rating.value ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 text-gray-200'}
                        />
                      ))}
                      {order.rating.comment && (
                        <span className="text-[10px] text-slate-400 font-semibold italic truncate max-w-[140px]">{order.rating.comment}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="md:col-span-7">
          {selectedOrder ? (
            <div className="bg-white rounded-[3rem] p-8 border border-slate-100 shadow-2xl h-fit animate-in fade-in slide-in-from-right-4">
              <div className="flex justify-between items-center mb-8 pb-6 border-b border-slate-50">
                <div>
                  <h2 className="text-xl font-black text-slate-900">Summary</h2>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{selectedOrder.deliverySlot}</p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Deliver to</p>
                    <p className="text-xs font-bold text-slate-600 max-w-[150px] truncate">{selectedOrder.address}</p>
                </div>
              </div>

              <div className="space-y-4 mb-8 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {selectedOrder.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-4 hover:bg-slate-50 p-2 rounded-2xl transition-colors">
                    {resolveImageUrl(item) ? (
                      <img src={resolveImageUrl(item)} className="w-14 h-14 rounded-xl object-cover" alt={item.name} />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center text-[8px] font-black uppercase tracking-widest text-slate-300">No Image</div>
                    )}
                    <div className="flex-1">
                      <h4 className="font-black text-slate-800 text-sm leading-tight">{item.name}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{item.quantity} x {item.unit}</p>
                    </div>
                    <p className="font-black text-slate-900 text-sm">₹{item.price * item.quantity}</p>
                  </div>
                ))}
              </div>

              <div className="bg-slate-50 rounded-3xl p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Grand Total</span>
                  <span className="text-2xl font-black text-slate-900">₹{selectedOrder.totalAmount}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  {selectedOrder.status === 'DELIVERED' && (
                    <>
                      <button onClick={() => handleReorder(selectedOrder.items)} className="flex items-center justify-center gap-2 bg-[#1e293b] text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all">
                        <RotateCcw size={14} /> Reorder
                      </button>
                      

                      <button
                        onClick={() => handleDownloadInvoice(selectedOrder.id)}
                        disabled={isDownloadingInvoice}
                        className="flex items-center justify-center gap-2 border-2 border-emerald-200 text-emerald-700 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isDownloadingInvoice ? <Loader2 size={14} className="animate-spin" /> : 'Download Order Summary'}
                      </button>

                      {/* RATE ORDER BUTTON */}
                      {!selectedOrder.rating?.value ? (
                        <button
                          onClick={() => openRatingModal(selectedOrder.id)}
                          className="flex items-center justify-center gap-2 border-2 border-amber-200 text-amber-600 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-50 transition-all"
                        >
                          <Star size={14} /> Rate Order
                        </button>
                      ) : (
                        <div className="flex flex-col items-center justify-center border-2 border-amber-100 bg-amber-50 py-3 rounded-2xl gap-1">
                          <div className="flex gap-0.5">
                            {[1,2,3,4,5].map(s => (
                              <Star key={s} size={14} className={s <= selectedOrder.rating.value ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 text-gray-200'} />
                            ))}
                          </div>
                          {selectedOrder.rating.comment && (
                            <p className="text-[10px] text-amber-700 font-semibold italic px-3 text-center truncate max-w-full">{selectedOrder.rating.comment}</p>
                          )}
                        </div>
                      )}

                      {/* REPORT ISSUE TOGGLE */}
                      {settings?.allowReportIssue && (
                        <button onClick={() => setIsReportModalOpen(true)} className="flex items-center justify-center gap-2 border-2 border-orange-100 text-orange-600 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-50 transition-all">
                          <AlertCircle size={14} /> Report Issue
                        </button>
                      )}
                    </>
                  )}

                  {['PLACED', 'CONFIRMED'].includes(selectedOrder.status) && settings?.allowOrderCancellation && (
                    <button onClick={() => setIsCancelModalOpen(true)} className="col-span-2 flex items-center justify-center gap-2 border-2 border-red-100 text-red-500 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-50 transition-all">
                      Cancel Order
                    </button>
                  )}

                  {selectedOrder.status === 'OUT_FOR_DELIVERY' && (
                    <div className="col-span-2 space-y-3">
                      <button className="w-full flex items-center justify-center gap-2 bg-white border-2 border-slate-200 text-slate-400 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest cursor-not-allowed">
                        <Clock size={14} /> Tracking in Progress...
                      </button>
                      <div className="border-2 border-blue-100 bg-blue-50 rounded-2xl p-4">
                        <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest mb-1">Delivery Partner</p>
                        <p className="text-sm font-black text-slate-800">
                          {selectedOrder.deliveryPartner?.name || 'Will be assigned soon'}
                        </p>
                        <p className="text-xs text-slate-600 mt-1">
                          {selectedOrder.deliveryPartner?.phoneNumber
                            ? `Mobile: ${selectedOrder.deliveryPartner.phoneNumber}`
                            : 'Mobile number will appear once assigned'}
                        </p>
                        {selectedOrder.deliveryPartner?.phoneNumber && (
                          <a
                            href={`tel:${selectedOrder.deliveryPartner.phoneNumber}`}
                            className="inline-flex mt-3 items-center justify-center rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                          >
                            Contact Partner
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {['ISSUE_REPORTED', 'REFUND_APPROVED', 'REFUND_REJECTED'].includes(selectedOrder.status) && (
                    <div className={`col-span-2 border-2 p-5 rounded-[2rem] space-y-3 animate-in fade-in zoom-in-95 ${
                      selectedOrder.status === 'REFUND_APPROVED' ? 'bg-emerald-50 border-emerald-100' : 
                      selectedOrder.status === 'REFUND_REJECTED' ? 'bg-red-50 border-red-100' : 
                      'bg-purple-50 border-purple-100'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg text-white ${
                          selectedOrder.status === 'REFUND_APPROVED' ? 'bg-emerald-500' : 
                          selectedOrder.status === 'REFUND_REJECTED' ? 'bg-red-500' : 'bg-purple-600'
                        }`}>
                          {selectedOrder.status === 'REFUND_APPROVED' ? <CheckCircle2 size={16} /> : 
                           selectedOrder.status === 'REFUND_REJECTED' ? <X size={16} /> : 
                           <Clock size={16} />}
                        </div>
                        <div>
                          <p className={`text-[10px] font-black uppercase tracking-widest ${
                            selectedOrder.status === 'REFUND_APPROVED' ? 'text-emerald-700' : 
                            selectedOrder.status === 'REFUND_REJECTED' ? 'text-red-700' : 'text-purple-700'
                          }`}>
                            {STATUS_THEME[selectedOrder.status]?.label}
                          </p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">
                            {selectedOrder.status === 'ISSUE_REPORTED' ? 'Reviewing your request' : 'Resolution Provided'}
                          </p>
                        </div>
                      </div>

                      {selectedOrder.adminNote && (
                        <div className="bg-white/80 p-3 rounded-2xl border border-black/5 shadow-sm">
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-1 tracking-tighter">Support Message:</p>
                          <p className="text-xs font-bold text-slate-700 leading-relaxed italic uppercase tracking-tight">
                            "{selectedOrder.adminNote}"
                          </p>
                        </div>
                      )}

                      {selectedOrder.status !== 'ISSUE_REPORTED' && (
                        <button 
                          onClick={() => handleReorder(selectedOrder.items)} 
                          className="w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-colors"
                        >
                          Reorder These Items
                        </button>
                      )}
                    </div>
                  )}

                  {selectedOrder.status === 'CANCELLED' && (
                    <button onClick={() => handleReorder(selectedOrder.items)} className="col-span-2 flex items-center justify-center gap-2 bg-[#1e293b] text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">
                      <RotateCcw size={14} /> Try Reordering
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="hidden lg:flex flex-col items-center justify-center h-[500px] text-slate-200 border-2 border-dashed border-slate-100 rounded-[3rem]">
              <Package size={64} strokeWidth={1} />
              <p className="font-black uppercase tracking-widest text-[10px] mt-4 italic">Select an order to see details</p>
            </div>
          )}
        </div>
      </div>

      {isCancelModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-6">
                    <AlertTriangle size={32} />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-2 uppercase italic tracking-tighter">Cancel Order?</h3>
                <p className="text-slate-500 font-bold text-sm mb-8 leading-relaxed">This action cannot be undone. Are you sure you want to cancel this fresh delivery?</p>
                <div className="flex gap-3">
                    <button onClick={() => setIsCancelModalOpen(false)} className="flex-1 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">No, Keep It</button>
                    <button onClick={handleCancelOrder} className="flex-1 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-200 transition-all">Yes, Cancel</button>
                </div>
            </div>
        </div>
      )}

      <ReportIssueModal 
        isOpen={isReportModalOpen} 
        onClose={() => setIsReportModalOpen(false)} 
        order={selectedOrder}
        onSuccess={handleReportSuccess}
      />

      {/* RATING MODAL */}
      {showRatingModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Rate Your Order</h3>
              <button onClick={() => setShowRatingModal(false)} className="p-2 rounded-full hover:bg-slate-100 text-slate-400">
                <X size={18} />
              </button>
            </div>
            <p className="text-slate-400 font-bold text-sm mb-6 leading-relaxed">
              How was your experience? Your feedback helps us improve.
            </p>

            {/* Stars */}
            <div className="flex justify-center gap-3 mb-6">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  onClick={() => { setStarValue(s); setRatingError(''); }}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    size={40}
                    className={s <= starValue ? 'fill-amber-400 text-amber-400' : 'fill-gray-100 text-gray-300'}
                  />
                </button>
              ))}
            </div>

            {/* Comment */}
            <textarea
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
              placeholder="Any comments? (optional)"
              maxLength={300}
              rows={3}
              className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-semibold text-slate-700 placeholder:text-slate-300 outline-none focus:border-amber-300 resize-none mb-2"
            />

            {ratingError && (
              <p className="text-red-500 text-xs font-bold mb-3">{ratingError}</p>
            )}

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowRatingModal(false)}
                className="flex-1 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Skip
              </button>
              <button
                onClick={submitRating}
                disabled={isSubmittingRating}
                className="flex-1 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest bg-amber-400 text-white hover:bg-amber-500 shadow-lg shadow-amber-100 transition-all disabled:opacity-60"
              >
                {isSubmittingRating ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;