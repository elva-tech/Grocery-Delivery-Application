import React, { useState, useEffect } from 'react';
import { Clock, Calendar, Save, CheckCircle, Power } from 'lucide-react';
import { saveSchedule, getSchedule, toggleStore } from '../../api/scheduleApi';

const Schedule = () => {
  const [type, setType] = useState('TIME');
  const [currentSchedule, setCurrentSchedule] = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [toggling, setToggling] = useState(false);

  const [form, setForm] = useState({
    startTime: '',
    endTime: '',
    startDate: '',
    endDate: '',
    reason: ''
  });

  useEffect(() => {
    const load = async () => {
      const data = await getSchedule();
      setCurrentSchedule(data);
      if (typeof data?.isOpen === 'boolean') setIsOpen(data.isOpen);
    };
    load();
  }, []);

  const isLocked = currentSchedule?.isActive;

  // Manual toggle – open/close immediately
  const handleToggle = async () => {
    try {
      setToggling(true);
      const res = await toggleStore(!isOpen);
      setIsOpen(res.isOpen);
      setCurrentSchedule((prev) => ({ ...prev, isOpen: res.isOpen, manualOverride: true }));
    } catch {
      // silent
    } finally {
      setToggling(false);
    }
  };

  const handleSave = async () => {
    // Build UTC ISO strings from the form inputs
    let openISO, closeISO;

    if (type === 'TIME') {
      // Use today's date + the chosen time
      const today = new Date().toISOString().slice(0, 10);
      openISO  = new Date(`${today}T${form.startTime}:00`).toISOString();
      closeISO = new Date(`${today}T${form.endTime}:00`).toISOString();
    } else {
      // DATE mode – combine date + time
      openISO  = new Date(`${form.startDate}T${form.startTime || '00:00'}:00`).toISOString();
      closeISO = new Date(`${form.endDate}T${form.endTime || '23:59'}:00`).toISOString();
    }

    await saveSchedule({ openTime: openISO, closeTime: closeISO });

    setCurrentSchedule({
      type,
      ...form,
      isActive: true
    });

    setShowPopup(true);
    setTimeout(() => setShowPopup(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-100 p-6">
      <div className="max-w-2xl mx-auto space-y-6">

      {showPopup && (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">

    <div className="bg-white w-full max-w-sm p-8 rounded-3xl shadow-2xl text-center animate-fadeIn">

      {/* Icon */}
      <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
        <CheckCircle className="text-green-600" size={28} />
      </div>

      {/* Title */}
      <h2 className="text-xl font-black text-gray-900 mb-2">
        Schedule Saved
      </h2>

      {/* Sub text */}
      <p className="text-sm text-gray-500 mb-6">
        Your schedule has been applied successfully
      </p>

      {/* Button */}
      <button
        onClick={() => setShowPopup(false)}
        className="w-full bg-green-600 text-white py-3 rounded-xl font-bold"
      >
        OK
      </button>

    </div>

  </div>
)}
        {/* MANUAL TOGGLE */}
        <div className="bg-white rounded-3xl p-5 shadow-md border border-gray-100 flex items-center justify-between">
          <div>
            <p className="font-bold text-gray-900">Store Status</p>
            <p className={`text-sm font-semibold mt-0.5 ${isOpen ? 'text-green-600' : 'text-red-500'}`}>
              {isOpen ? '🟢 Open' : '🔴 Closed'}
              {currentSchedule?.manualOverride && (
                <span className="ml-2 text-xs text-gray-400 font-normal">(Manual override)</span>
              )}
            </p>
          </div>
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white transition-all ${
              isOpen ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
            } disabled:opacity-50`}
          >
            <Power className="w-4 h-4" />
            {toggling ? 'Updating…' : isOpen ? 'Close Store' : 'Open Store'}
          </button>
        </div>

        {/* ACTIVE SCHEDULE */}
        {currentSchedule?.isActive && (
          <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 border border-yellow-300 p-5 rounded-2xl shadow-sm">
            <p className="font-bold text-yellow-900 mb-1">
              Active Schedule
            </p>

            {currentSchedule.type === "TIME" && (
              <p className="text-sm text-yellow-800">
                Daily: {currentSchedule.startTime} → {currentSchedule.endTime}
              </p>
            )}

            {currentSchedule.type === "DATE" && (
              <p className="text-sm text-yellow-800">
                {currentSchedule.startDate} → {currentSchedule.endDate}
              </p>
            )}

            <p className="text-xs text-gray-600 mt-1">
              {currentSchedule.reason}
            </p>
          </div>
        )}

        {/* HEADER */}
        <div className="bg-white rounded-3xl p-6 shadow-md border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-black text-gray-900">
              Store Schedule
            </h1>
          </div>
        </div>

        {/* TYPE */}
        <div className="bg-white rounded-3xl p-6 shadow-md border border-gray-100">
          <div className="grid grid-cols-2 gap-4">

            <button
              onClick={() => setType('TIME')}
              className={`p-5 rounded-2xl border-2 transition-all ${
                type === 'TIME'
                  ? 'border-blue-600 bg-gradient-to-br from-blue-50 to-indigo-50 shadow'
                  : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <Clock className="mx-auto mb-2" />
              <p className="font-bold">Regular Based</p>
              <p className="text-xs text-gray-500">Daily automatic</p>
            </button>

            <button
              onClick={() => setType('DATE')}
              className={`p-5 rounded-2xl border-2 transition-all ${
                type === 'DATE'
                  ? 'border-blue-600 bg-gradient-to-br from-blue-50 to-indigo-50 shadow'
                  : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <Calendar className="mx-auto mb-2" />
              <p className="font-bold">Occasion Based</p>
              <p className="text-xs text-gray-500">Date + time</p>
            </button>

          </div>
        </div>

        {/* FORM */}
        <div className="bg-white rounded-3xl p-6 space-y-4 shadow-md border border-gray-100">

          {type === 'TIME' && (
            <>
              <input
                type="time"
                disabled={isLocked}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="time"
                disabled={isLocked}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500"
              />
            </>
          )}

          {type === 'DATE' && (
            <>
              <input
                type="date"
                disabled={isLocked}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full p-3 border rounded-xl"
              />
              <input
                type="date"
                disabled={isLocked}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="w-full p-3 border rounded-xl"
              />

              <input
                type="time"
                disabled={isLocked}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className="w-full p-3 border rounded-xl"
              />
              <input
                type="time"
                disabled={isLocked}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className="w-full p-3 border rounded-xl"
              />
            </>
          )}

          <textarea
            disabled={isLocked}
            placeholder="Reason"
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            className="w-full p-3 border rounded-xl"
          />

        </div>

        {/* SAVE */}
        <button
          onClick={handleSave}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
        >
          <Save className="w-5 h-5" />
          Save Schedule
        </button>

        {/* STOP */}
        {currentSchedule?.isActive && (
          <button
            onClick={async () => {
              await saveSchedule({ isActive: false });
              setCurrentSchedule({ isActive: false });
              setIsOpen(true);
            }}
            className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white py-3 rounded-2xl font-bold shadow-md"
          >
            Stop Schedule (Open Store)
          </button>
        )}

      </div>

      {/* ANIMATION */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default Schedule;