import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, getDoc, increment } from 'firebase/firestore';
import { UserProfile, Message, Session } from '../types';
import { Send, Video, Mic, MapPin, X, MessageSquare, Phone, MoreVertical, Star, AlertTriangle, ThumbsDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import { handleFirestoreError, OperationType } from '../App';

interface SessionInterfaceProps {
  sessionId: string;
  user: UserProfile;
  onClose: () => void;
}

export default function SessionInterface({ sessionId, user, onClose }: SessionInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportProof, setReportProof] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [notSatisfied, setNotSatisfied] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [incomingCall, setIncomingCall] = useState<{ type: 'audio' | 'video', callerId: string } | null>(null);
  const [callType, setCallType] = useState<'audio' | 'video' | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubSession = onSnapshot(doc(db, 'sessions', sessionId), (doc) => {
      if (doc.exists()) {
        const data = doc.data() as Session;
        setSession({ id: doc.id, ...data });
        
        // Handle incoming call signaling
        if ((data as any).callActive && (data as any).callerId !== user.uid) {
          if (!isCalling && !incomingCall) {
            setIncomingCall({ 
              type: (data as any).callType, 
              callerId: (data as any).callerId 
            });
          }
        } else if (!(data as any).callActive) {
          stopCall();
          setIncomingCall(null);
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `sessions/${sessionId}`);
    });

    const q = query(
      collection(db, 'sessions', sessionId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubMessages = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)));
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `sessions/${sessionId}/messages`);
    });

    return () => {
      unsubSession();
      unsubMessages();
      stopCall();
    };
  }, [sessionId]);

  const startCall = async (type: 'audio' | 'video') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: type === 'video', 
        audio: true 
      });
      localStreamRef.current = stream;
      
      setIsCalling(true);
      setCallType(type);
      
      // Use a small timeout to ensure the ref is attached after state update
      setTimeout(() => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      }, 100);
      
      await updateDoc(doc(db, 'sessions', sessionId), {
        callActive: true,
        callType: type,
        callerId: user.uid
      });
      
      toast.success(`${type === 'video' ? 'Video' : 'Audio'} call started`);
    } catch (err) {
      console.error('Call Error:', err);
      toast.error('Could not access camera/microphone. Please check permissions.');
    }
  };

  const acceptCall = async () => {
    if (!incomingCall) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: incomingCall.type === 'video', 
        audio: true 
      });
      localStreamRef.current = stream;
      
      setIsCalling(true);
      setCallType(incomingCall.type);
      setIncomingCall(null);
      
      setTimeout(() => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      }, 100);

      toast.success('Call accepted');
    } catch (err) {
      console.error('Accept Call Error:', err);
      toast.error('Could not access camera/microphone');
    }
  };

  const declineCall = async () => {
    setIncomingCall(null);
    try {
      await updateDoc(doc(db, 'sessions', sessionId), {
        callActive: false
      });
    } catch (e) {}
  };

  const stopCall = async () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    setIsCalling(false);
    setCallType(null);
    setIncomingCall(null);
    
    try {
      const sessionSnap = await getDoc(doc(db, 'sessions', sessionId));
      if (sessionSnap.exists() && sessionSnap.data().callActive) {
        await updateDoc(doc(db, 'sessions', sessionId), {
          callActive: false
        });
      }
    } catch (e) {}
  };

  const shareLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      const mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
      
      await addDoc(collection(db, 'sessions', sessionId, 'messages'), {
        sessionId,
        senderId: user.uid,
        text: `📍 My Location: ${mapUrl}`,
        timestamp: new Date().toISOString()
      });
      toast.success('Location shared');
    }, () => {
      toast.error('Unable to retrieve your location');
    });
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await addDoc(collection(db, 'sessions', sessionId, 'messages'), {
        sessionId,
        senderId: user.uid,
        text: newMessage,
        timestamp: new Date().toISOString()
      });
      setNewMessage('');
    } catch (error) {
      console.error('Send Error:', error);
      toast.error('Failed to send message.');
    }
  };

  const submitReport = async () => {
    if (!reportReason) {
      toast.error('Please provide a reason');
      return;
    }

    try {
      const reportedId = user.role === 'user' ? session?.expertId : session?.userId;
      await addDoc(collection(db, 'reports'), {
        reporterId: user.uid,
        reportedId,
        sessionId,
        reason: reportReason,
        proof: reportProof || messages.slice(-5).map(m => m.text).join('\n'),
        createdAt: new Date().toISOString()
      });

      // Increment report count and check for ban
      const reportedRef = doc(db, 'users', reportedId!);
      const reportedSnap = await getDoc(reportedRef);
      if (reportedSnap.exists()) {
        const data = reportedSnap.data();
        const newCount = (data.reportCount || 0) + 1;
        await updateDoc(reportedRef, {
          reportCount: increment(1),
          isBanned: newCount >= 3
        });
      }

      toast.success('Report submitted. We will investigate.');
      setShowReport(false);
    } catch (error) {
      console.error('Report Error:', error);
      toast.error('Failed to submit report');
    }
  };

  const submitFeedback = async () => {
    try {
      await addDoc(collection(db, 'feedback'), {
        sessionId,
        userId: user.uid,
        expertId: session?.expertId,
        rating,
        comment,
        notSatisfied,
        createdAt: new Date().toISOString()
      });

      // Update expert stats
      const expertRef = doc(db, 'users', session!.expertId);
      const expertSnap = await getDoc(expertRef);
      if (expertSnap.exists()) {
        const data = expertSnap.data();
        const nsCount = (data.notSatisfiedCount || 0) + (notSatisfied ? 1 : 0);
        const totalR = (data.totalRatings || 0) + 1;
        const currentR = data.rating || 5;
        const newRating = (currentR * data.totalRatings + rating) / totalR;

        await updateDoc(expertRef, {
          rating: newRating,
          totalRatings: totalR,
          notSatisfiedCount: increment(notSatisfied ? 1 : 0),
          isBanned: nsCount >= 10
        });
      }

      toast.success('Thank you for your feedback!');
      onClose();
    } catch (error) {
      console.error('Feedback Error:', error);
    }
  };

  const endSession = async () => {
    try {
      await updateDoc(doc(db, 'sessions', sessionId), {
        status: 'ended',
        endTime: new Date().toISOString()
      });
      
      if (user.role === 'user') {
        setShowFeedback(true);
      } else {
        onClose();
      }
    } catch (error) {
      console.error('End Session Error:', error);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col h-[80vh] relative">
      {/* Incoming Call UI */}
      <AnimatePresence>
        {incomingCall && (
          <motion.div 
            initial={{ opacity: 0, y: -100, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -100, scale: 0.8 }}
            className="absolute top-6 left-1/2 -translate-x-1/2 z-[70] bg-neutral-900 text-white p-6 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 flex items-center gap-8 min-w-[400px] backdrop-blur-xl"
          >
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center animate-pulse">
                  {incomingCall.type === 'video' ? <Video className="w-8 h-8" /> : <Phone className="w-8 h-8" />}
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-neutral-900 animate-ping"></div>
              </div>
              <div>
                <p className="text-lg font-bold">Incoming {incomingCall.type} Call</p>
                <p className="text-sm text-neutral-400">Expert is waiting for you...</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={declineCall}
                className="bg-red-500/10 text-red-500 p-4 rounded-2xl hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
              >
                <X className="w-6 h-6" />
              </button>
              <button 
                onClick={acceptCall}
                className="bg-emerald-600 text-white px-6 py-4 rounded-2xl hover:bg-emerald-700 transition-all flex items-center gap-3 font-bold shadow-lg shadow-emerald-900/20"
              >
                <Phone className="w-6 h-6 animate-bounce" />
                Attend
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Call Overlay */}
      <AnimatePresence>
        {isCalling && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[60] bg-neutral-950 flex flex-col items-center justify-center text-white"
          >
            <div className="relative w-full h-full flex items-center justify-center">
              {callType === 'video' ? (
                <div className="w-full h-full relative bg-black">
                  <video 
                    ref={localVideoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-full object-cover opacity-80"
                  />
                  {/* Remote Video Placeholder (Simulated) */}
                  <div className="absolute bottom-24 right-8 w-48 h-72 bg-neutral-800 rounded-2xl border border-white/10 shadow-2xl overflow-hidden z-10">
                    <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-900">
                      <div className="w-12 h-12 bg-neutral-800 rounded-full flex items-center justify-center mb-2">
                        <Video className="w-6 h-6 text-neutral-600" />
                      </div>
                      <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Remote User</p>
                    </div>
                  </div>

                  <div className="absolute top-8 left-8 flex items-center gap-3 bg-black/40 backdrop-blur-xl p-4 rounded-2xl border border-white/10">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    <p className="text-sm font-bold uppercase tracking-widest">Live Session Active</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="relative">
                    <div className="w-40 h-40 bg-indigo-600 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(79,70,229,0.4)] relative z-10">
                      <Mic className="w-16 h-16" />
                    </div>
                    <div className="absolute inset-0 bg-indigo-600 rounded-full animate-ping opacity-20"></div>
                    <div className="absolute inset-0 bg-indigo-600 rounded-full animate-pulse opacity-10 scale-150"></div>
                  </div>
                  <h2 className="text-3xl font-bold mt-12">Audio Call Connected</h2>
                  <p className="text-neutral-400 mt-4 text-lg">Your microphone is live</p>
                </div>
              )}
              
              <div className="absolute bottom-12 flex gap-8 items-center">
                <button className="p-4 bg-white/10 rounded-full hover:bg-white/20 transition-all">
                  <Mic className="w-6 h-6" />
                </button>
                <button 
                  onClick={stopCall}
                  className="bg-red-600 p-8 rounded-full hover:bg-red-700 transition-all shadow-[0_10px_30px_rgba(220,38,38,0.4)] hover:scale-110 active:scale-95 group"
                >
                  <X className="w-10 h-10 group-hover:rotate-90 transition-transform" />
                </button>
                <button className="p-4 bg-white/10 rounded-full hover:bg-white/20 transition-all">
                  <Video className="w-6 h-6" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="bg-neutral-900 p-4 flex justify-between items-center text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold">Expert Session</h3>
            <p className="text-xs text-neutral-400 flex items-center gap-1">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              Live Connection
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => startCall('video')}
            className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
            title="Video Call"
          >
            <Video className="w-5 h-5" />
          </button>
          <button 
            onClick={() => startCall('audio')}
            className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
            title="Audio Call"
          >
            <Phone className="w-5 h-5" />
          </button>
          <button 
            onClick={shareLocation}
            className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
            title="Share Location"
          >
            <MapPin className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setShowReport(true)}
            className="p-2 hover:bg-red-900/30 text-red-400 rounded-lg transition-colors"
            title="Report Misbehavior"
          >
            <AlertTriangle className="w-5 h-5" />
          </button>
          <div className="w-px h-6 bg-neutral-700 mx-2"></div>
          <button 
            onClick={endSession}
            className="bg-red-600/10 text-red-500 px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-600 hover:text-white transition-all"
          >
            End Session
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-grow overflow-y-auto p-6 space-y-4 bg-neutral-50">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex ${msg.senderId === user.uid ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[70%] p-4 rounded-2xl shadow-sm ${
              msg.senderId === user.uid 
                ? 'bg-indigo-600 text-white rounded-tr-none' 
                : 'bg-white text-neutral-800 rounded-tl-none border border-neutral-100'
            }`}>
              {msg.text.startsWith('📍 My Location:') ? (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-bold">Shared Location</span>
                  <a 
                    href={msg.text.split(': ')[1]} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-white/20 p-2 rounded-lg hover:bg-white/30 transition-all"
                  >
                    <MapPin className="w-4 h-4" />
                    View on Maps
                  </a>
                </div>
              ) : (
                <p className="text-sm leading-relaxed">{msg.text}</p>
              )}
              <p className={`text-[10px] mt-1 opacity-60 ${msg.senderId === user.uid ? 'text-right' : 'text-left'}`}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-neutral-100">
        <form onSubmit={sendMessage} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-grow px-4 py-3 rounded-xl bg-neutral-100 border-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
          <button
            type="submit"
            className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            <Send className="w-6 h-6" />
          </button>
        </form>
      </div>

      {/* Report Modal */}
      <AnimatePresence>
        {showReport && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
            >
              <div className="flex items-center gap-3 text-red-600 mb-4">
                <AlertTriangle className="w-8 h-8" />
                <h2 className="text-2xl font-bold">Report Misbehavior</h2>
              </div>
              <p className="text-neutral-500 mb-6">Your safety is our priority. Please describe the issue.</p>
              
              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Reason</label>
                  <select 
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full p-3 rounded-xl bg-neutral-50 border border-neutral-200 outline-none"
                  >
                    <option value="">Select a reason</option>
                    <option value="harassment">Harassment</option>
                    <option value="inappropriate_content">Inappropriate Content</option>
                    <option value="scam">Scam / Fraud</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Additional Proof (Optional)</label>
                  <textarea
                    value={reportProof}
                    onChange={(e) => setReportProof(e.target.value)}
                    placeholder="Describe what happened..."
                    className="w-full p-3 rounded-xl bg-neutral-50 border border-neutral-200 outline-none h-24"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowReport(false)}
                  className="flex-1 py-4 rounded-2xl font-bold text-neutral-600 hover:bg-neutral-100 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={submitReport}
                  className="flex-1 bg-red-600 text-white py-4 rounded-2xl font-bold hover:bg-red-700 transition-all"
                >
                  Submit Report
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feedback Modal */}
      <AnimatePresence>
        {showFeedback && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
            >
              <h2 className="text-2xl font-bold text-center mb-2">Session Ended</h2>
              <p className="text-neutral-500 text-center mb-8">How was your experience with the expert?</p>
              
              <div className="flex justify-center gap-2 mb-8">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    onClick={() => setRating(s)}
                    className={`p-2 transition-all ${rating >= s ? 'text-amber-400' : 'text-neutral-200'}`}
                  >
                    <Star className={`w-10 h-10 ${rating >= s ? 'fill-current' : ''}`} />
                  </button>
                ))}
              </div>

              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Leave a comment (optional)"
                className="w-full p-4 rounded-2xl bg-neutral-50 border border-neutral-200 focus:ring-2 focus:ring-indigo-500 outline-none mb-6 h-24"
              />

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setNotSatisfied(!notSatisfied)}
                  className={`w-full py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${
                    notSatisfied ? 'bg-red-100 text-red-600' : 'bg-neutral-100 text-neutral-600'
                  }`}
                >
                  <ThumbsDown className="w-5 h-5" />
                  {notSatisfied ? 'Marked as Not Satisfied' : 'Not Satisfied?'}
                </button>
                
                <button
                  onClick={submitFeedback}
                  className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all"
                >
                  Submit Feedback
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
