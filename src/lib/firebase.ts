import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInAnonymously,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
  arrayRemove,
} from 'firebase/firestore';
import { cloudinaryConfig, DEFAULT_AVATAR, firebaseConfig, ROOT_ADMIN_EMAILS } from './config';
import type { TwinPost, TwinStory, TwinUser } from '../types';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const ONLINE_WINDOW_MS = 2 * 60 * 1000;

export function isGuestUser(user: TwinUser | null | undefined): boolean {
  if (!user) return true;
  return Boolean(user.isGuest || user.role === 'guest' || user.isAnonymous || user.uid === 'guest_local');
}

export function isUserAdmin(user: TwinUser | null | undefined): boolean {
  if (!user || isGuestUser(user)) return false;
  if (user.role === 'admin') return true;
  if (user.email && ROOT_ADMIN_EMAILS.includes(user.email.toLowerCase())) return true;
  return false;
}

export function createGuestProfile(uid = ''): TwinUser {
  return {
    uid: uid || 'guest_local',
    name: 'Khách',
    email: '',
    role: 'guest',
    isGuest: true,
    isAnonymous: Boolean(uid && uid !== 'guest_local'),
    avatar: DEFAULT_AVATAR,
    cover: '',
    bio: 'Chế độ Khách (chỉ xem). Đăng nhập để đăng bài, bình luận và nhắn tin.',
    friends: [],
    friendRequests: [],
    savedPosts: [],
    showActivity: false,
    isOnline: false,
  };
}

export async function signInAsGuest(): Promise<TwinUser> {
  try {
    const cred = await signInAnonymously(auth);
    return createGuestProfile(cred.user.uid);
  } catch {
    return createGuestProfile('guest_local');
  }
}

export async function signInWithEmail(email: string, password: string): Promise<FirebaseUser> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  await ensureUserDoc(cred.user);
  return cred.user;
}

export async function registerWithEmail(name: string, email: string, password: string): Promise<FirebaseUser> {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const displayName = name.trim() || email.split('@')[0];
  await updateProfile(cred.user, { displayName });
  await ensureUserDoc(cred.user, { name: displayName });
  return cred.user;
}

export async function signInWithGoogle(): Promise<FirebaseUser> {
  const cred = await signInWithPopup(auth, googleProvider);
  await ensureUserDoc(cred.user);
  return cred.user;
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function signOutUser(uid?: string): Promise<void> {
  if (uid && uid !== 'guest_local') {
    await updateDoc(doc(db, 'users', uid), {
      isOnline: false,
      lastActiveAt: Date.now(),
    }).catch(() => {});
  }
  await signOut(auth);
}

export async function ensureUserDoc(fbUser: FirebaseUser, extra: { name?: string } = {}): Promise<TwinUser> {
  if (fbUser.isAnonymous) return createGuestProfile(fbUser.uid);

  const ref = doc(db, 'users', fbUser.uid);
  const snap = await getDoc(ref);
  const isRootAdmin = Boolean(fbUser.email && ROOT_ADMIN_EMAILS.includes(fbUser.email.toLowerCase()));

  if (!snap.exists()) {
    const profile: TwinUser = {
      uid: fbUser.uid,
      name: extra.name || fbUser.displayName || fbUser.email?.split('@')[0] || 'Thành viên Twin',
      email: fbUser.email || '',
      role: isRootAdmin ? 'admin' : 'member',
      showEmail: true,
      showPersonalInfo: true,
      showActivity: true,
      avatar: fbUser.photoURL || DEFAULT_AVATAR,
      cover: '',
      bio: 'Xin chào, mình đang dùng Twin!',
      birthday: '',
      hometown: '',
      location: '',
      work: '',
      education: '',
      gender: '',
      relationship: '',
      phone: '',
      website: '',
      friends: [],
      friendRequests: [],
      savedPosts: [],
      isOnline: true,
      lastActiveAt: Date.now(),
      createdAt: serverTimestamp(),
    };
    await setDoc(ref, profile);
    return profile;
  }

  const data = snap.data() as TwinUser;
  const patch: {
    isOnline: boolean;
    lastActiveAt: number;
    email?: string;
    role?: 'admin' | 'member';
  } = {
    isOnline: true,
    lastActiveAt: Date.now(),
  };
  if (fbUser.email && data.email !== fbUser.email) {
    patch.email = fbUser.email;
    data.email = fbUser.email;
  }
  if (isRootAdmin && data.role !== 'admin') {
    patch.role = 'admin';
    data.role = 'admin';
  }
  updateDoc(ref, patch).catch(() => {});
  return { ...data, uid: fbUser.uid };
}

export async function pushNotification(
  toUid: string,
  payload: {
    fromUid: string;
    fromName: string;
    fromAvatar?: string;
    type?: 'reaction' | 'comment' | 'message' | 'friend' | 'general';
    text: string;
    link?: string;
    postId?: string;
    storyId?: string;
  }
): Promise<void> {
  if (!toUid || toUid === payload.fromUid) return;
  const docData: Record<string, unknown> = {
    toUid,
    fromUid: payload.fromUid,
    fromName: payload.fromName || 'Thành viên Twin',
    fromAvatar: payload.fromAvatar || DEFAULT_AVATAR,
    type: payload.type || 'general',
    text: payload.text,
    link: payload.link || './index.html',
    read: false,
    createdAtMs: Date.now(),
    createdAt: serverTimestamp(),
  };
  if (payload.postId) docData.postId = payload.postId;
  if (payload.storyId) docData.storyId = payload.storyId;
  await addDoc(collection(db, 'notifications'), docData);
}

export function getChatId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

export async function unfriendUser(myUid: string, targetUid: string): Promise<void> {
  await Promise.all([
    updateDoc(doc(db, 'users', myUid), { friends: arrayRemove(targetUid) }),
    updateDoc(doc(db, 'users', targetUid), { friends: arrayRemove(myUid) }),
  ]);
}

export function toMillis(ts: unknown): number {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'object' && ts !== null) {
    const obj = ts as { toMillis?: () => number; seconds?: number };
    if (typeof obj.toMillis === 'function') return obj.toMillis();
    if (typeof obj.seconds === 'number') return obj.seconds * 1000;
  }
  const parsed = Date.parse(String(ts));
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function formatTime(ts: unknown): string {
  const ms = toMillis(ts);
  if (!ms) return 'Vừa xong';
  const diff = Math.max(0, Date.now() - ms);
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return 'Vừa xong';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} phút trước`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} ngày trước`;
  const d = new Date(ms);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

export function formatDuration(seconds = 0): string {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function formatFileSize(bytes = 0): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getUserPresence(user: TwinUser | null | undefined): {
  online: boolean;
  label: string;
} {
  if (!user || user.showActivity === false) {
    return { online: false, label: '' };
  }
  const lastMs = toMillis(user.lastActiveAt);
  const isOnline = Boolean(user.isOnline && lastMs && Date.now() - lastMs <= ONLINE_WINDOW_MS);
  if (isOnline) return { online: true, label: 'Đang hoạt động' };
  if (!lastMs) return { online: false, label: 'Ngoại tuyến' };
  return { online: false, label: `Hoạt động ${formatTime(lastMs)}` };
}

export function canViewPost(post: TwinPost, viewer: TwinUser | null): boolean {
  const privacy = post.privacy || 'public';
  if (privacy === 'public') return true;
  if (!viewer || isGuestUser(viewer)) return false;
  if (isUserAdmin(viewer) || post.authorUid === viewer.uid) return true;
  if (privacy === 'friends') {
    const allowed = Array.isArray(post.allowedFriendUids) ? post.allowedFriendUids : [];
    const viewerFriends = Array.isArray(viewer.friends) ? viewer.friends : [];
    return allowed.includes(viewer.uid) || viewerFriends.includes(post.authorUid);
  }
  return false;
}

export function canViewStory(story: TwinStory, viewer: TwinUser | null): boolean {
  const privacy = story.privacy || 'public';
  if (privacy === 'public') return true;
  if (!viewer || isGuestUser(viewer)) return false;
  if (isUserAdmin(viewer) || story.authorUid === viewer.uid) return true;
  if (privacy === 'friends') {
    const allowed = Array.isArray(story.allowedFriendUids) ? story.allowedFriendUids : [];
    const viewerFriends = Array.isArray(viewer.friends) ? viewer.friends : [];
    return allowed.includes(viewer.uid) || viewerFriends.includes(story.authorUid);
  }
  return false;
}

export function getPostImages(post: TwinPost): string[] {
  const list: string[] = [];
  if (Array.isArray(post.images)) {
    post.images.forEach((img) => {
      if (img && typeof img === 'string' && !list.includes(img)) list.push(img);
    });
  }
  if (post.imageUrl && !list.includes(post.imageUrl)) {
    list.unshift(post.imageUrl);
  }
  return list;
}

export function getVideoPosterUrl(videoUrl = ''): string {
  const s = String(videoUrl || '').trim();
  if (!s || !s.includes('res.cloudinary.com') || !s.includes('/video/upload/')) return '';
  return s
    .replace('/video/upload/', '/video/upload/so_auto,f_jpg,q_auto/')
    .replace(/\.(mp4|mov|webm|m4v|ogv)(\?.*)?$/i, '.jpg');
}

export function friendlyError(err: unknown): string {
  const e = err as { code?: string; message?: string };
  const code = e?.code || '';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
    return 'Email hoặc mật khẩu chưa chính xác.';
  }
  if (code === 'auth/user-not-found') return 'Không tìm thấy tài khoản với email này.';
  if (code === 'auth/email-already-in-use') return 'Email này đã được đăng ký trước đó.';
  if (code === 'auth/weak-password') return 'Mật khẩu cần ít nhất 6 ký tự.';
  if (code === 'auth/popup-closed-by-user') return 'Bạn đã đóng cửa sổ đăng nhập Google.';
  if (code === 'auth/unauthorized-domain') {
    return 'Tên miền này chưa được thêm vào Authorized Domains của Firebase. Bạn có thể đăng nhập bằng Email/Mật khẩu.';
  }
  if (code === 'permission-denied') return 'Bạn không có quyền thực hiện thao tác này.';
  return e?.message || 'Đã xảy ra lỗi, vui lòng thử lại.';
}

export async function uploadImageToCloudinary(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Chỉ hỗ trợ tệp hình ảnh.');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Ảnh quá lớn (tối đa 10MB).');
  }
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', cloudinaryConfig.uploadPreset);
  formData.append('folder', 'twin_uploads');

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    throw new Error('Tải ảnh lên thất bại. Vui lòng thử lại.');
  }
  const data = await res.json();
  return data.secure_url as string;
}

export function uploadVideoToCloudinary(
  file: File,
  onProgress?: (pct: number) => void,
  maxSizeMb = 80
): Promise<{ url: string; poster: string; duration: number }> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('video/')) {
      reject(new Error('Chỉ hỗ trợ tệp video (MP4, MOV, WebM).'));
      return;
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      reject(new Error(`Video vượt quá giới hạn ${maxSizeMb}MB.`));
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);
    formData.append('folder', 'twin_videos');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/video/upload`);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && onProgress) {
        onProgress(Math.round((ev.loaded / ev.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        const url = data.secure_url as string;
        resolve({
          url,
          poster: getVideoPosterUrl(url),
          duration: Math.round(Number(data.duration) || 0),
        });
      } else {
        reject(new Error('Tải video lên thất bại.'));
      }
    };
    xhr.onerror = () => reject(new Error('Lỗi kết nối khi tải video.'));
    xhr.send(formData);
  });
}

export async function uploadChatAttachmentToCloudinary(
  file: File,
  onProgress?: (pct: number) => void
): Promise<{
  kind: 'image' | 'video' | 'file';
  url: string;
  poster?: string;
  name: string;
  size: number;
  mime: string;
}> {
  if (file.type.startsWith('image/')) {
    onProgress?.(40);
    const url = await uploadImageToCloudinary(file);
    onProgress?.(100);
    return { kind: 'image', url, name: file.name, size: file.size, mime: file.type };
  }
  if (file.type.startsWith('video/')) {
    const uploaded = await uploadVideoToCloudinary(file, onProgress, 40);
    return {
      kind: 'video',
      url: uploaded.url,
      poster: uploaded.poster,
      name: file.name,
      size: file.size,
      mime: file.type,
    };
  }
  if (file.size > 25 * 1024 * 1024) {
    throw new Error('Tệp đính kèm tối đa 25MB.');
  }
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', cloudinaryConfig.uploadPreset);
  formData.append('folder', 'twin_files');
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/auto/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Tải tệp lên thất bại.');
  const data = await res.json();
  onProgress?.(100);
  return {
    kind: 'file',
    url: data.secure_url as string,
    name: file.name,
    size: file.size,
    mime: file.type || 'application/octet-stream',
  };
}
