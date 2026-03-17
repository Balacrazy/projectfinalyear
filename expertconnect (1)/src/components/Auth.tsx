import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { UserProfile, UserRole } from '../types';
import { Shield, User, Briefcase, CheckCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'react-hot-toast';

interface AuthProps {
  onComplete: (profile: UserProfile) => void;
}

export default function Auth({ onComplete }: AuthProps) {
  const [role, setRole] = useState<UserRole>('user');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;

      const userRef = doc(db, 'users', firebaseUser.uid);
      const userDoc = await getDoc(userRef);

      let profile: UserProfile;

      if (!userDoc.exists()) {
        profile = {
          uid: firebaseUser.uid,
          email: firebaseUser.email!,
          displayName: firebaseUser.displayName || 'Anonymous',
          photoURL: firebaseUser.photoURL || '',
          role: role,
          createdAt: new Date().toISOString(),
          rating: 5.0,
          totalRatings: 0
        };
        await setDoc(userRef, profile);
        toast.success(`Welcome to ExpertConnect as a ${role}!`);
      } else {
        profile = userDoc.data() as UserProfile;
        toast.success(`Welcome back, ${profile.displayName}!`);
      }

      onComplete(profile);
    } catch (error) {
      console.error('Login Error:', error);
      toast.error('Failed to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md relative z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="bg-indigo-600 p-4 rounded-2xl mb-4 shadow-lg shadow-indigo-200">
            <Shield className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-neutral-900">ExpertConnect</h1>
          <p className="text-neutral-500 text-center mt-2">Professional expert assistance platform</p>
        </div>

        <div className="space-y-4 mb-8">
          <p className="text-sm font-semibold text-neutral-400 uppercase tracking-wider text-center">Select your role</p>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setRole('user')}
              className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
                role === 'user' 
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-600' 
                  : 'border-neutral-100 hover:border-neutral-200 text-neutral-500'
              }`}
            >
              <User className="w-6 h-6 mb-2" />
              <span className="font-medium">I need help</span>
            </button>
            <button
              onClick={() => setRole('expert')}
              className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
                role === 'expert' 
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-600' 
                  : 'border-neutral-100 hover:border-neutral-200 text-neutral-500'
              }`}
            >
              <Briefcase className="w-6 h-6 mb-2" />
              <span className="font-medium">I am an expert</span>
            </button>
          </div>
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-neutral-900 text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-3 hover:bg-neutral-800 transition-all disabled:opacity-50"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          ) : (
            <>
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
              Continue with Google
            </>
          )}
        </button>

        <div className="mt-8 pt-8 border-t border-neutral-100">
          <div className="flex items-center gap-3 text-sm text-neutral-500">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span>Secure OTP-based authentication</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-neutral-500 mt-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span>Real-time expert matching</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
