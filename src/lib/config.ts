export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCfVk2pGzaEaALnwo3fRqe7rYNINxY4nrU',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'ndtwws99-1999.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'ndtwws99-1999',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'ndtwws99-1999.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '750729468514',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:750729468514:web:306e0736ae2d473f138f3b',
  measurementId: 'G-00ZRYF0Y8S',
};

export const cloudinaryConfig = {
  cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'oaagraxi',
  uploadPreset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'ndtwws99',
};

export const ROOT_ADMIN_EMAILS = ['ndtwws99@gmail.com'];

export const DEFAULT_AVATAR =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#E5E9F0"/><circle cx="60" cy="46" r="21" fill="#94A3B8"/><path d="M24 108c4-22 18-34 36-34s32 12 36 34" fill="#94A3B8"/></svg>`
  );

export const STORY_BACKGROUNDS = [
  { id: 'ocean', label: 'Đại dương', css: 'linear-gradient(135deg, #0084FF 0%, #0052CC 100%)' },
  { id: 'sunset', label: 'Hoàng hôn', css: 'linear-gradient(135deg, #F97316 0%, #E11D48 100%)' },
  { id: 'forest', label: 'Rừng xanh', css: 'linear-gradient(135deg, #059669 0%, #0D9488 100%)' },
  { id: 'midnight', label: 'Đêm sâu', css: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)' },
  { id: 'amber', label: 'Nắng sớm', css: 'linear-gradient(135deg, #F59E0B 0%, #EA580C 100%)' },
  { id: 'indigo', label: 'Chàm tối', css: 'linear-gradient(135deg, #3B82F6 0%, #4F46E5 100%)' },
];

export function getStoryBgCss(bgIdOrCss?: string): string {
  if (!bgIdOrCss) return STORY_BACKGROUNDS[0].css;
  if (bgIdOrCss.includes('gradient') || bgIdOrCss.startsWith('#')) return bgIdOrCss;
  return STORY_BACKGROUNDS.find((b) => b.id === bgIdOrCss)?.css || STORY_BACKGROUNDS[0].css;
}
