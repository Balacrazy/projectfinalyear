import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, setDoc } from 'firebase/firestore';
import { UserProfile, HelpRequest } from '../types';
import { Briefcase, Clock, CheckCircle, MessageSquare, Star, Zap, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { handleFirestoreError, OperationType } from '../App';

interface ExpertDashboardProps {
  user: UserProfile;
  onJoinSession: (sessionId: string) => void;
}

export default function ExpertDashboard({ user, onJoinSession }: ExpertDashboardProps) {
  const [availableRequests, setAvailableRequests] = useState<HelpRequest[]>([]);
  const [activeRequests, setActiveRequests] = useState<HelpRequest[]>([]);

  useEffect(() => {
    // Available requests (pending)
    const qAvailable = query(
      collection(db, 'requests'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeAvailable = onSnapshot(qAvailable, (snapshot) => {
      setAvailableRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HelpRequest)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'requests_available');
    });

    // Requests accepted by this expert
    const qActive = query(
      collection(db, 'requests'),
      where('expertId', '==', user.uid),
      where('status', '==', 'accepted')
    );

    const unsubscribeActive = onSnapshot(qActive, (snapshot) => {
      setActiveRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HelpRequest)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'requests_active');
    });

    return () => {
      unsubscribeAvailable();
      unsubscribeActive();
    };
  }, [user.uid]);

  const handleAccept = async (req: HelpRequest) => {
    try {
      const sessionId = `session_${req.id}`;
      
      // Update request status
      await updateDoc(doc(db, 'requests', req.id), {
        status: 'accepted',
        expertId: user.uid,
        expertName: user.displayName
      });

      // Create session doc
      await setDoc(doc(db, 'sessions', sessionId), {
        id: sessionId,
        requestId: req.id,
        userId: req.userId,
        expertId: user.uid,
        status: 'active',
        startTime: new Date().toISOString()
      });

      toast.success('Request accepted! Joining session...');
      onJoinSession(sessionId);
    } catch (error) {
      console.error('Accept Error:', error);
      toast.error('Failed to accept request.');
    }
  };

  return (
    <div className="space-y-12">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
          <div className="flex items-center gap-3 text-indigo-600 mb-2">
            <Star className="w-5 h-5" />
            <span className="text-sm font-bold uppercase tracking-wider">Rating</span>
          </div>
          <div className="text-3xl font-bold">{user.rating?.toFixed(1) || '5.0'}</div>
          <p className="text-neutral-500 text-sm mt-1">Based on {user.totalRatings || 0} sessions</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
          <div className="flex items-center gap-3 text-emerald-600 mb-2">
            <Zap className="w-5 h-5" />
            <span className="text-sm font-bold uppercase tracking-wider">Active</span>
          </div>
          <div className="text-3xl font-bold">{activeRequests.length}</div>
          <p className="text-neutral-500 text-sm mt-1">Ongoing help sessions</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
          <div className="flex items-center gap-3 text-amber-600 mb-2">
            <Bell className="w-5 h-5" />
            <span className="text-sm font-bold uppercase tracking-wider">Available</span>
          </div>
          <div className="text-3xl font-bold">{availableRequests.length}</div>
          <p className="text-neutral-500 text-sm mt-1">New requests waiting</p>
        </div>
      </div>

      {/* Active Sessions */}
      {activeRequests.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            Active Sessions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {activeRequests.map((req) => (
              <div key={req.id} className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-indigo-900">{req.title}</h3>
                  <p className="text-sm text-indigo-700">User: {req.userName}</p>
                </div>
                <button
                  onClick={() => onJoinSession(`session_${req.id}`)}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-semibold hover:bg-indigo-700 transition-all"
                >
                  Resume
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Available Requests */}
      <section>
        <h2 className="text-xl font-bold mb-6">Available Requests</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {availableRequests.map((req) => (
            <motion.div
              key={req.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-neutral-200 p-6 flex flex-col hover:shadow-xl transition-all"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <img 
                    src={`https://ui-avatars.com/api/?name=${req.userName}&background=random`} 
                    className="w-6 h-6 rounded-full" 
                    alt="" 
                  />
                  <span className="text-xs font-medium text-neutral-500">{req.userName}</span>
                </div>
                <span className="text-xs text-neutral-400">
                  {formatDistanceToNow(new Date(req.createdAt))} ago
                </span>
              </div>

              <h3 className="text-lg font-bold mb-2 line-clamp-1">{req.title}</h3>
              <p className="text-neutral-600 text-sm mb-6 line-clamp-3 flex-grow">{req.description}</p>

              <div className="flex items-center gap-2 text-xs text-amber-600 font-medium bg-amber-50 p-3 rounded-xl mb-4">
                <Clock className="w-4 h-4" />
                Expires in {Math.max(0, Math.ceil((new Date(req.expiresAt).getTime() - Date.now()) / 60000))} mins
              </div>

              <button
                onClick={() => handleAccept(req)}
                className="w-full bg-neutral-900 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-neutral-800 transition-all"
              >
                <CheckCircle className="w-5 h-5" />
                Accept Request
              </button>
            </motion.div>
          ))}
        </div>

        {availableRequests.length === 0 && (
          <div className="text-center py-20 bg-neutral-50 rounded-3xl border border-dashed border-neutral-300">
            <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Briefcase className="text-neutral-300 w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-neutral-900">No pending requests</h3>
            <p className="text-neutral-500 mt-2">New requests will appear here in real-time.</p>
          </div>
        )}
      </section>
    </div>
  );
}
