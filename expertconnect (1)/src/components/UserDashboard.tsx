import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { UserProfile, HelpRequest } from '../types';
import { PlusCircle, Clock, CheckCircle, MessageSquare, AlertCircle, ExternalLink, Youtube, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { handleFirestoreError, OperationType } from '../App';

interface UserDashboardProps {
  user: UserProfile;
  onJoinSession: (sessionId: string) => void;
}

export default function UserDashboard({ user, onJoinSession }: UserDashboardProps) {
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'requests'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HelpRequest));
      setRequests(reqs);

      // Check for accepted requests to trigger session
      reqs.forEach(req => {
        if (req.status === 'accepted' && req.expertId) {
          // Find or create session
          // For simplicity, we'll assume the expert creates the session doc
        }
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'requests');
    });

    return () => unsubscribe();
  }, [user.uid]);

  // Timer logic for auto-response
  useEffect(() => {
    const interval = setInterval(async () => {
      const now = new Date();
      for (const req of requests) {
        if (req.status === 'pending' && new Date(req.expiresAt) < now) {
          await handleAutoResponse(req);
        }
      }
    }, 30000); // Check every 30s

    return () => clearInterval(interval);
  }, [requests]);

  const handleAutoResponse = async (req: HelpRequest) => {
    try {
      const response = await fetch('/api/auto-respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: req.title, description: req.description })
      });
      const data = await response.json();
      
      await updateDoc(doc(db, 'requests', req.id), {
        status: 'auto_responded',
        autoResponse: data
      });
      toast.success('Expert unavailable. AI has generated a solution for you!');
    } catch (error) {
      console.error('Auto-response error:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) return;

    setLoading(true);
    try {
      const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString(); // 20 minutes
      await addDoc(collection(db, 'requests'), {
        userId: user.uid,
        userName: user.displayName,
        title,
        description,
        status: 'pending',
        createdAt: new Date().toISOString(),
        expiresAt
      });
      setShowNewRequest(false);
      setTitle('');
      setDescription('');
      toast.success('Request posted! Experts have been notified.');
    } catch (error) {
      console.error('Submit Error:', error);
      toast.error('Failed to post request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Your Requests</h2>
          <p className="text-neutral-500">Track and manage your help requests</p>
        </div>
        <button
          onClick={() => setShowNewRequest(true)}
          className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
        >
          <PlusCircle className="w-5 h-5" />
          New Request
        </button>
      </div>

      <AnimatePresence>
        {showNewRequest && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white rounded-2xl border border-neutral-200 p-6 overflow-hidden"
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Problem Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., React state not updating in useEffect"
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Detailed Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your problem in detail..."
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all h-32"
                  required
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewRequest(false)}
                  className="px-6 py-3 rounded-xl font-medium text-neutral-600 hover:bg-neutral-100 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-neutral-900 text-white px-8 py-3 rounded-xl font-semibold hover:bg-neutral-800 transition-all disabled:opacity-50"
                >
                  {loading ? 'Posting...' : 'Post Request'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {requests.map((req) => (
          <motion.div
            key={req.id}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl border border-neutral-200 p-6 flex flex-col h-full hover:shadow-xl transition-all"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                req.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                req.status === 'accepted' ? 'bg-indigo-100 text-indigo-700' :
                req.status === 'auto_responded' ? 'bg-emerald-100 text-emerald-700' :
                'bg-neutral-100 text-neutral-700'
              }`}>
                {req.status.replace('_', ' ')}
              </div>
              <span className="text-xs text-neutral-400">
                {formatDistanceToNow(new Date(req.createdAt))} ago
              </span>
            </div>

            <h3 className="text-lg font-bold mb-2 line-clamp-1">{req.title}</h3>
            <p className="text-neutral-600 text-sm mb-6 line-clamp-3 flex-grow">{req.description}</p>

            {req.status === 'pending' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-amber-600 font-medium bg-amber-50 p-3 rounded-xl">
                  <Clock className="w-4 h-4" />
                  Auto-response in {Math.max(0, Math.ceil((new Date(req.expiresAt).getTime() - Date.now()) / 60000))} mins
                </div>
                <button
                  onClick={() => handleAutoResponse(req)}
                  className="w-full py-2 text-xs font-bold text-indigo-600 border border-indigo-200 rounded-xl hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
                >
                  <Search className="w-3 h-3" />
                  Get AI Help Now
                </button>
              </div>
            )}

            {req.status === 'accepted' && (
              <button
                onClick={() => {
                  // In a real app, we'd fetch the sessionId from a sessions collection
                  // For this demo, we'll use a deterministic ID
                  onJoinSession(`session_${req.id}`);
                }}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all"
              >
                <MessageSquare className="w-5 h-5" />
                Join Session
              </button>
            )}

            {req.status === 'auto_responded' && req.autoResponse && (
              <div className="space-y-4 mt-4 pt-4 border-t border-neutral-100">
                <div className="bg-emerald-50 p-4 rounded-xl">
                  <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm mb-2">
                    <Search className="w-4 h-4" />
                    AI Summary
                  </div>
                  <p className="text-xs text-neutral-700 leading-relaxed">{req.autoResponse.summary}</p>
                </div>
                
                {req.autoResponse.videos && req.autoResponse.videos.length > 0 && (
                  <div className="bg-indigo-50 p-4 rounded-xl">
                    <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm mb-2">
                      <Youtube className="w-4 h-4" />
                      Recommended Videos
                    </div>
                    <div className="space-y-2">
                      {req.autoResponse.videos.map((video, i) => (
                        <a 
                          key={i} 
                          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(video)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs flex items-center gap-2 text-neutral-700 hover:text-indigo-600 transition-colors"
                        >
                          <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></div>
                          {video}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  {req.autoResponse.links.map((link, i) => (
                    <a 
                      key={i} 
                      href={link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs flex items-center gap-1.5 bg-white border border-neutral-200 px-3 py-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-all"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Resource {i + 1}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {requests.length === 0 && !showNewRequest && (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-neutral-300">
          <div className="bg-neutral-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="text-neutral-400 w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-neutral-900">No requests yet</h3>
          <p className="text-neutral-500 mt-2">Post your first problem to get expert help!</p>
        </div>
      )}
    </div>
  );
}
