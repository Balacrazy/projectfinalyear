import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, orderBy, limit, getDocFromServer } from 'firebase/firestore';
import { Toaster, toast } from 'react-hot-toast';
import { UserProfile, HelpRequest } from './types';
import { LogIn, LogOut, User as UserIcon, Shield, MessageSquare, Clock, CheckCircle, Search, PlusCircle, Video, MapPin, Star, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import Markdown from 'react-markdown';

// Error Handling
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  toast.error(`Permission Error: ${operationType} on ${path}`);
  throw new Error(JSON.stringify(errInfo));
}

// Components
import Auth from './components/Auth';
import UserDashboard from './components/UserDashboard';
import ExpertDashboard from './components/ExpertDashboard';
import SessionInterface from './components/SessionInterface';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [view, setView] = useState<'dashboard' | 'session'>('dashboard');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          setUser(userDoc.data() as UserProfile);
        } else {
          // New user - handled in Auth component
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    // Test connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Firebase connection error: Client is offline.");
        }
      }
    };
    testConnection();

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Toaster position="top-right" />
        <Auth onComplete={(profile) => setUser(profile)} />
      </>
    );
  }

  if (user.isBanned) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl text-center">
          <div className="bg-red-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="text-red-600 w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold text-neutral-900 mb-4">Account Banned</h1>
          <p className="text-neutral-600 mb-8">
            Your account has been suspended due to multiple reports or low satisfaction ratings. 
            If you believe this is a mistake, please contact support.
          </p>
          <button 
            onClick={() => signOut(auth)}
            className="w-full bg-neutral-900 text-white py-4 rounded-2xl font-bold hover:bg-neutral-800 transition-all"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
      <Toaster position="top-right" />
      
      {/* Navigation */}
      <nav className="bg-white border-b border-neutral-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('dashboard')}>
              <div className="bg-indigo-600 p-2 rounded-lg">
                <Shield className="text-white w-6 h-6" />
              </div>
              <span className="text-xl font-bold tracking-tight">ExpertConnect</span>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="hidden md:flex flex-col items-end mr-2">
                <span className="text-sm font-medium">{user.displayName}</span>
                <span className="text-xs text-neutral-500 capitalize">{user.role}</span>
              </div>
              <img 
                src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                alt="Profile" 
                className="w-10 h-10 rounded-full border border-neutral-200"
              />
              <button 
                onClick={() => signOut(auth)}
                className="p-2 text-neutral-500 hover:text-red-600 transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {view === 'dashboard' ? (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {user.role === 'expert' ? (
                <ExpertDashboard 
                  user={user} 
                  onJoinSession={(id) => {
                    setActiveSessionId(id);
                    setView('session');
                  }} 
                />
              ) : (
                <UserDashboard 
                  user={user} 
                  onJoinSession={(id) => {
                    setActiveSessionId(id);
                    setView('session');
                  }} 
                />
              )}
            </motion.div>
          ) : (
            <motion.div
              key="session"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <SessionInterface 
                sessionId={activeSessionId!} 
                user={user} 
                onClose={() => setView('dashboard')} 
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
