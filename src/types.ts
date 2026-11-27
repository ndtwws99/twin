export type NavTab =
  | 'post'
  | 'reels'
  | 'messages'
  | 'notifications'
  | 'profile'
  | 'friends'
  | 'saved';

export type PrivacyLevel = 'public' | 'friends' | 'private';

export type ReactionKey = 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry';

export interface TwinUser {
  uid: string;
  name: string;
  email?: string;
  role?: 'admin' | 'member' | 'guest';
  isGuest?: boolean;
  isAnonymous?: boolean;
  avatar?: string;
  cover?: string;
  bio?: string;
  birthday?: string;
  hometown?: string;
  location?: string;
  work?: string;
  education?: string;
  gender?: string;
  relationship?: string;
  phone?: string;
  website?: string;
  friends?: string[];
  friendRequests?: string[];
  savedPosts?: string[];
  showActivity?: boolean;
  showEmail?: boolean;
  showPersonalInfo?: boolean;
  isOnline?: boolean;
  lastActiveAt?: unknown;
  createdAt?: unknown;
}

export interface TwinComment {
  id: string;
  authorUid: string;
  authorName: string;
  authorAvatar?: string;
  text: string;
  createdAt: number;
}

export interface TwinPost {
  id: string;
  authorUid: string;
  authorName: string;
  authorAvatar?: string;
  content?: string;
  isHtml?: boolean;
  feeling?: string;
  privacy?: PrivacyLevel;
  allowedFriendUids?: string[];
  imageUrl?: string;
  images?: string[];
  videoUrl?: string;
  videoType?: string;
  videoDuration?: number;
  videoPoster?: string;
  pinned?: boolean;
  reactions?: Record<string, ReactionKey>;
  savedBy?: string[];
  sharesCount?: number;
  comments?: TwinComment[];
  groupId?: string;
  groupName?: string;
  createdAt?: unknown;
}

export interface TwinStoryReply {
  id: string;
  authorUid: string;
  authorName: string;
  authorAvatar?: string;
  text: string;
  createdAt: number;
}

export interface TwinStory {
  id: string;
  authorUid: string;
  authorName: string;
  authorAvatar?: string;
  type: 'image' | 'text' | 'video';
  imageUrl?: string;
  videoUrl?: string;
  videoPoster?: string;
  duration?: number;
  caption?: string;
  text?: string;
  bgId?: string;
  fontClass?: string;
  privacy?: PrivacyLevel;
  allowedFriendUids?: string[];
  likes?: string[];
  reactions?: Record<string, ReactionKey>;
  savedBy?: string[];
  sharesCount?: number;
  replies?: TwinStoryReply[];
  createdAt?: unknown;
}

export interface TwinNotification {
  id: string;
  toUid: string;
  fromUid: string;
  fromName?: string;
  fromAvatar?: string;
  type?: 'reaction' | 'comment' | 'message' | 'friend' | 'general';
  text: string;
  link?: string;
  read?: boolean;
  postId?: string;
  storyId?: string;
  createdAtMs?: number;
  createdAt?: unknown;
}

export interface TwinMessage {
  id: string;
  senderUid: string;
  senderName?: string;
  text?: string;
  imageUrl?: string;
  videoUrl?: string;
  videoPoster?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileMime?: string;
  linkUrl?: string;
  linkTitle?: string;
  storyReply?: {
    storyId: string;
    type?: string;
    previewText?: string;
  };
  createdAt?: unknown;
}
