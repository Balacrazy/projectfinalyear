export type UserRole = 'user' | 'expert' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  skills?: string[];
  bio?: string;
  rating?: number;
  totalRatings?: number;
  notSatisfiedCount?: number;
  reportCount?: number;
  isBanned?: boolean;
  createdAt: string;
}

export type RequestStatus = 'pending' | 'accepted' | 'completed' | 'auto_responded';

export interface HelpRequest {
  id: string;
  userId: string;
  userName: string;
  title: string;
  description: string;
  status: RequestStatus;
  expertId?: string;
  expertName?: string;
  createdAt: string;
  expiresAt: string;
  autoResponse?: {
    summary: string;
    links: string[];
    videos: string[];
  };
}

export interface Session {
  id: string;
  requestId: string;
  userId: string;
  expertId: string;
  status: 'active' | 'ended';
  startTime: string;
  endTime?: string;
}

export interface Message {
  id: string;
  sessionId: string;
  senderId: string;
  text: string;
  timestamp: string;
}

export interface Feedback {
  id: string;
  sessionId: string;
  userId: string;
  expertId: string;
  rating: number;
  comment: string;
  createdAt: string;
}
