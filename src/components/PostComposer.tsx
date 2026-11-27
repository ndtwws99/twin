import { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Globe, Image as ImageIcon, Lock, Smile, Users, X } from 'lucide-react';
import { Avatar } from './Avatar';
import { DEFAULT_AVATAR } from '../lib/config';
import { FEELINGS, PRIVACY_OPTIONS } from '../lib/constants';
import { db, friendlyError, isGuestUser, uploadImageToCloudinary } from '../lib/firebase';
import type { PrivacyLevel, TwinUser } from '../types';

interface PostComposerProps {
  currentUser: TwinUser | null;
  initialExpanded?: boolean;
  onPublished?: () => void;
  onCancel?: () => void;
  onOpenAuth: () => void;
  onOpenProfile: (uid: string) => void;
  onToast: (msg: string) => void;
}

export function PostComposer({
  currentUser,
  initialExpanded = false,
  onPublished,
  onCancel,
  onOpenAuth,
  onOpenProfile,
  onToast,
}: PostComposerProps) {
  const [expanded, setExpanded] = useState(initialExpanded);
  const [showFeelings, setShowFeelings] = useState(false);
  const [content, setContent] = useState('');
  const [feeling, setFeeling] = useState('');
  const [privacy, setPrivacy] = useState<PrivacyLevel>('public');
  const [imageFiles, setImageFiles] = useState<{ file: File; preview: string }[]>([]);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);

  const guest = isGuestUser(currentUser);
  const firstName = (currentUser?.name || 'Bạn').split(' ').slice(-1)[0];

  const handleExpand = (openFeelings = false) => {
    if (guest) {
      onToast('Đăng nhập tài khoản để đăng bài viết mới.');
      onOpenAuth();
      return;
    }
    setExpanded(true);
    if (openFeelings) setShowFeelings(true);
  };

  const handleSelectImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (guest) {
      onOpenAuth();
      return;
    }
    const files = Array.from(e.target.files || []).slice(0, 8 - imageFiles.length);
    if (!files.length) return;
    setImageFiles((prev) => [
      ...prev,
      ...files.map((file) => ({ file, preview: URL.createObjectURL(file) })),
    ]);
    setExpanded(true);
    e.target.value = '';
  };

  const handlePublish = async () => {
    if (!currentUser || guest) {
      onOpenAuth();
      return;
    }
    const cleanText = content.trim();
    if (!cleanText && imageFiles.length === 0) {
      onToast('Hãy nhập nội dung hoặc đính kèm hình ảnh.');
      return;
    }

    setPublishing(true);
    setUploadPct(null);
    try {
      const uploadedImages: string[] = [];
      for (let i = 0; i < imageFiles.length; i++) {
        setUploadPct(Math.round(((i + 0.3) / imageFiles.length) * 100));
        const url = await uploadImageToCloudinary(imageFiles[i].file);
        uploadedImages.push(url);
      }

      const allowedFriendUids =
        privacy === 'friends' && Array.isArray(currentUser.friends) ? currentUser.friends : [];

      await addDoc(collection(db, 'posts'), {
        authorUid: currentUser.uid,
        authorName: currentUser.name,
        authorAvatar: currentUser.avatar || DEFAULT_AVATAR,
        content: cleanText,
        isHtml: false,
        feeling,
        privacy,
        allowedFriendUids,
        imageUrl: uploadedImages[0] || '',
        images: uploadedImages,
        videoUrl: '',
        videoType: '',
        videoDuration: 0,
        videoPoster: '',
        pinned: false,
        reactions: {},
        savedBy: [],
        sharesCount: 0,
        comments: [],
        createdAt: serverTimestamp(),
      });

      setContent('');
      setFeeling('');
      setImageFiles([]);
      setUploadPct(null);
      setShowFeelings(false);
      setExpanded(initialExpanded);
      onToast('Đã đăng bài viết lên bảng tin!');
      onPublished?.();
    } catch (err) {
      onToast(friendlyError(err));
    } finally {
      setPublishing(false);
      setUploadPct(null);
    }
  };

  const selectedFeeling = FEELINGS.find((f) => f.value === feeling);

  return (
    <section
      aria-label="Tạo bài viết"
      className="bg-white dark:bg-[#131822] rounded-2xl border border-[#E5E7EB] dark:border-[#232B3A] px-4 pt-3.5 pb-2.5"
    >
      {/* Top Row: Avatar + Rounded Prompt */}
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onClick={() => {
            if (currentUser && !guest) onOpenProfile(currentUser.uid);
            else onOpenAuth();
          }}
          className="shrink-0 mt-0.5"
        >
          <Avatar src={currentUser?.avatar} name={currentUser?.name || 'Khách'} size="md" />
        </button>

        {!expanded ? (
          <button
            type="button"
            onClick={() => handleExpand(false)}
            className="flex-1 h-10 px-4 rounded-full bg-[#F2F4F7] dark:bg-[#1D2432] hover:bg-[#E7EBF0] dark:hover:bg-[#263043] text-left text-[15px] text-slate-500 dark:text-slate-400 transition-colors truncate"
          >
            {guest
              ? 'Đăng nhập để chia sẻ bài viết lên Twin...'
              : `${firstName} ơi, bạn đang nghĩ gì thế?`}
          </button>
        ) : (
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[15px] font-bold text-[#0F1419] dark:text-white">
                    {currentUser?.name}
                  </span>
                  {selectedFeeling && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      đang cảm thấy {selectedFeeling.emoji} {selectedFeeling.label.toLowerCase()}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F2F4F7] dark:bg-[#1D2432] text-[#0F1419] dark:text-slate-200">
                  {privacy === 'public' && <Globe className="w-3 h-3" />}
                  {privacy === 'friends' && <Users className="w-3 h-3" />}
                  {privacy === 'private' && <Lock className="w-3 h-3" />}
                  <select
                    value={privacy}
                    onChange={(e) => setPrivacy(e.target.value as PrivacyLevel)}
                    aria-label="Quyền riêng tư"
                    className="bg-transparent text-[11px] font-semibold focus:outline-none cursor-pointer"
                  >
                    {PRIVACY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-white dark:bg-[#131822]">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (onCancel) {
                    onCancel();
                  } else {
                    setExpanded(false);
                    setShowFeelings(false);
                  }
                }}
                aria-label="Đóng"
                className="w-8 h-8 rounded-full bg-[#F2F4F7] dark:bg-[#1D2432] hover:bg-[#E7EBF0] dark:hover:bg-[#263043] flex items-center justify-center text-slate-500 dark:text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              autoFocus
              placeholder={`${firstName} ơi, bạn đang nghĩ gì thế?`}
              className="w-full bg-transparent text-[15px] leading-relaxed text-[#0F1419] dark:text-white placeholder:text-slate-400 resize-none focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Feeling Selector Bar */}
      {expanded && showFeelings && (
        <div className="mt-2.5 pt-2.5 border-t border-[#EEF0F4] dark:border-[#232B3A]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Bạn đang cảm thấy thế nào?
            </span>
            {feeling && (
              <button
                type="button"
                onClick={() => setFeeling('')}
                className="text-xs font-medium text-[#0084FF] hover:underline"
              >
                Bỏ chọn
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {FEELINGS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => {
                  setFeeling(feeling === f.value ? '' : f.value);
                  setShowFeelings(false);
                }}
                className={`h-9 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  feeling === f.value
                    ? 'bg-[#0084FF]/15 text-[#0084FF]'
                    : 'hover:bg-[#F2F4F7] dark:hover:bg-[#1D2432] text-[#0F1419] dark:text-slate-200'
                }`}
              >
                <span>{f.emoji}</span>
                <span className="truncate">{f.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Image Preview Grid */}
      {imageFiles.length > 0 && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {imageFiles.map((item, idx) => (
            <div key={item.preview} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900">
              <img src={item.preview} alt={`Ảnh ${idx + 1}`} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setImageFiles((prev) => prev.filter((_, i) => i !== idx))}
                aria-label="Bỏ ảnh"
                className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload Progress */}
      {uploadPct !== null && (
        <div className="mt-3 space-y-1">
          <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-[#0084FF] transition-all duration-200"
              style={{ width: `${uploadPct}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            Đang tải ảnh lên... {uploadPct}%
          </p>
        </div>
      )}

      {/* 2-Button Action Strip: Ảnh (Photos Only) + Cảm xúc */}
      <div className="mt-3 pt-2 border-t border-[#EEF0F4] dark:border-[#232B3A] grid grid-cols-2 gap-1">
        <label className="h-10 rounded-xl hover:bg-[#F2F4F7] dark:hover:bg-[#1D2432] flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 cursor-pointer transition-colors whitespace-nowrap">
          <ImageIcon className="w-5 h-5 text-emerald-500 shrink-0" />
          <span>Ảnh</span>
          <input type="file" accept="image/*" multiple onChange={handleSelectImages} hidden />
        </label>

        <button
          type="button"
          onClick={() => handleExpand(true)}
          className="h-10 rounded-xl hover:bg-[#F2F4F7] dark:hover:bg-[#1D2432] flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 transition-colors whitespace-nowrap"
        >
          <Smile className="w-5 h-5 text-amber-500 shrink-0" />
          <span>Cảm xúc</span>
        </button>
      </div>

      {/* Full-width Publish Button when expanded */}
      {expanded && (
        <button
          type="button"
          disabled={publishing}
          onClick={handlePublish}
          className="mt-2.5 w-full h-10 rounded-xl bg-[#0084FF] hover:bg-[#0073E6] disabled:opacity-50 text-white text-sm font-semibold transition-colors"
        >
          {publishing ? 'Đang đăng bài...' : 'Đăng bài'}
        </button>
      )}
    </section>
  );
}
