import { useMemo, useState } from 'react';
import { arrayRemove, arrayUnion, doc, updateDoc } from 'firebase/firestore';
import {
  Briefcase,
  Camera,
  Globe,
  GraduationCap,
  MapPin,
  MessageCircle,
  Pencil,
  ShieldCheck,
  UserCheck,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react';
import { Avatar } from './Avatar';
import { PostCard } from './PostCard';
import { PostComposer } from './PostComposer';
import {
  db,
  friendlyError,
  getPostImages,
  isGuestUser,
  isUserAdmin,
  pushNotification,
  unfriendUser,
  uploadImageToCloudinary,
} from '../lib/firebase';
import type { TwinPost, TwinUser } from '../types';

interface ProfileViewProps {
  profileUid: string | null;
  currentUser: TwinUser | null;
  users: TwinUser[];
  userMap: Record<string, TwinUser>;
  posts: TwinPost[];
  onOpenProfile: (uid: string) => void;
  onStartChat: (peer: TwinUser) => void;
  onOpenLightbox: (images: string[], index: number) => void;
  onOpenAuth: () => void;
  onToast: (msg: string) => void;
}

type ProfileTab = 'posts' | 'photos' | 'friends' | 'saved';

export function ProfileView({
  profileUid,
  currentUser,
  users,
  userMap,
  posts,
  onOpenProfile,
  onStartChat,
  onOpenLightbox,
  onOpenAuth,
  onToast,
}: ProfileViewProps) {
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [editOpen, setEditOpen] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const guest = isGuestUser(currentUser);
  const targetUid = profileUid || currentUser?.uid || '';
  const profileUser = userMap[targetUid] || (targetUid === currentUser?.uid ? currentUser : null);
  const isOwnProfile = Boolean(currentUser && !guest && profileUser && profileUser.uid === currentUser.uid);

  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editWork, setEditWork] = useState('');
  const [editEducation, setEditEducation] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const userPosts = useMemo(
    () => posts.filter((p) => p.authorUid === targetUid),
    [posts, targetUid]
  );

  const userPhotos = useMemo(() => {
    const imgs: string[] = [];
    userPosts.forEach((p) => {
      getPostImages(p).forEach((img) => imgs.push(img));
    });
    return imgs;
  }, [userPosts]);

  const profileFriends = useMemo(() => {
    const ids = Array.isArray(profileUser?.friends) ? profileUser.friends : [];
    return ids.map((uid) => userMap[uid]).filter(Boolean);
  }, [profileUser, userMap]);

  const savedPosts = useMemo(() => {
    if (!isOwnProfile || !currentUser) return [];
    return posts.filter((p) => Array.isArray(p.savedBy) && p.savedBy.includes(currentUser.uid));
  }, [posts, isOwnProfile, currentUser]);

  if (!profileUser || (isGuestUser(profileUser) && !profileUid)) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="bg-white dark:bg-[#131822] border border-[#E5E7EB] dark:border-[#232B3A] rounded-2xl p-8">
          <Avatar name="Khách" size="xl" className="mx-auto" />
          <h2 className="mt-4 text-lg font-bold text-[#0F1419] dark:text-white">Trang cá nhân</h2>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            Đăng nhập tài khoản để quản lý hồ sơ, ảnh đại diện, bài viết và bạn bè trên Twin.
          </p>
          <button
            type="button"
            onClick={onOpenAuth}
            className="mt-5 h-10 px-6 rounded-xl bg-[#0084FF] hover:bg-[#0073E6] text-white text-sm font-semibold transition-colors"
          >
            Đăng nhập
          </button>
        </div>
      </div>
    );
  }

  const myFriends = Array.isArray(currentUser?.friends) ? currentUser.friends : [];
  const myRequests = Array.isArray(currentUser?.friendRequests) ? currentUser.friendRequests : [];
  const targetRequests = Array.isArray(profileUser.friendRequests) ? profileUser.friendRequests : [];

  const isFriend = Boolean(currentUser && !guest && myFriends.includes(profileUser.uid));
  const hasIncomingRequest = Boolean(currentUser && !guest && myRequests.includes(profileUser.uid));
  const hasOutgoingRequest = Boolean(currentUser && !guest && targetRequests.includes(currentUser.uid));

  const openEditModal = () => {
    setEditName(profileUser.name || '');
    setEditBio(profileUser.bio || '');
    setEditWork(profileUser.work || '');
    setEditEducation(profileUser.education || '');
    setEditLocation(profileUser.location || '');
    setEditWebsite(profileUser.website || '');
    setEditOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !isOwnProfile) return;
    setSavingProfile(true);
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        name: editName.trim() || currentUser.name,
        bio: editBio.trim(),
        work: editWork.trim(),
        education: editEducation.trim(),
        location: editLocation.trim(),
        website: editWebsite.trim(),
      });
      setEditOpen(false);
      onToast('Đã cập nhật trang cá nhân.');
    } catch (err) {
      onToast(friendlyError(err));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUploadProfilePhoto = async (field: 'avatar' | 'cover', file: File) => {
    if (!currentUser || !isOwnProfile) return;
    setUploadingPhoto(true);
    try {
      const url = await uploadImageToCloudinary(file);
      await updateDoc(doc(db, 'users', currentUser.uid), { [field]: url });
      onToast(field === 'avatar' ? 'Đã cập nhật ảnh đại diện.' : 'Đã cập nhật ảnh bìa.');
    } catch (err) {
      onToast(friendlyError(err));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleFriendAction = async () => {
    if (!currentUser || guest) {
      onToast('Đăng nhập tài khoản để kết bạn.');
      onOpenAuth();
      return;
    }
    try {
      if (isFriend) {
        await unfriendUser(currentUser.uid, profileUser.uid);
        onToast(`Đã hủy kết bạn với ${profileUser.name}.`);
      } else if (hasIncomingRequest) {
        await Promise.all([
          updateDoc(doc(db, 'users', currentUser.uid), {
            friendRequests: arrayRemove(profileUser.uid),
            friends: arrayUnion(profileUser.uid),
          }),
          updateDoc(doc(db, 'users', profileUser.uid), {
            friends: arrayUnion(currentUser.uid),
            friendRequests: arrayRemove(currentUser.uid),
          }),
        ]);
        pushNotification(profileUser.uid, {
          fromUid: currentUser.uid,
          fromName: currentUser.name,
          fromAvatar: currentUser.avatar,
          type: 'friend',
          text: 'đã chấp nhận lời mời kết bạn của bạn.',
        }).catch(() => {});
        onToast(`Đã trở thành bạn bè với ${profileUser.name}.`);
      } else if (hasOutgoingRequest) {
        await updateDoc(doc(db, 'users', profileUser.uid), {
          friendRequests: arrayRemove(currentUser.uid),
        });
        onToast('Đã hủy lời mời kết bạn.');
      } else {
        await updateDoc(doc(db, 'users', profileUser.uid), {
          friendRequests: arrayUnion(currentUser.uid),
        });
        pushNotification(profileUser.uid, {
          fromUid: currentUser.uid,
          fromName: currentUser.name,
          fromAvatar: currentUser.avatar,
          type: 'friend',
          text: 'đã gửi cho bạn lời mời kết bạn.',
        }).catch(() => {});
        onToast(`Đã gửi lời mời kết bạn tới ${profileUser.name}.`);
      }
    } catch (err) {
      onToast(friendlyError(err));
    }
  };

  // Use users length only for avoiding unused prop warning if needed
  void users;

  return (
    <div className="max-w-[960px] mx-auto px-0 sm:px-5 pt-0 sm:pt-4 pb-20 md:pb-10 space-y-4">
      {/* Cover + Profile Header Card */}
      <section className="bg-white dark:bg-[#131822] sm:border border-[#E5E7EB] dark:border-[#232B3A] sm:rounded-2xl overflow-hidden">
        {/* Cover Image */}
        <div className="relative h-44 sm:h-64 bg-gradient-to-r from-[#0084FF]/20 via-[#38A5FF]/15 to-slate-200 dark:from-[#0084FF]/20 dark:via-[#1E293B] dark:to-[#0F172A]">
          {profileUser.cover && (
            <img
              src={profileUser.cover}
              alt="Ảnh bìa"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          )}
          {isOwnProfile && (
            <label className="absolute bottom-3 right-3 h-9 px-3.5 rounded-xl bg-black/60 hover:bg-black/75 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer backdrop-blur-xs transition-colors">
              <Camera className="w-4 h-4" />
              <span>{uploadingPhoto ? 'Đang tải...' : 'Đổi ảnh bìa'}</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUploadProfilePhoto('cover', f);
                  e.target.value = '';
                }}
                hidden
              />
            </label>
          )}
        </div>

        {/* Avatar + Name + Actions */}
        <div className="px-4 sm:px-6 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 sm:-mt-14">
            <div className="flex items-end gap-4">
              <div className="relative shrink-0 rounded-full ring-4 ring-white dark:ring-[#131822]">
                <Avatar src={profileUser.avatar} name={profileUser.name} size="xl" />
                {isOwnProfile && (
                  <label
                    title="Đổi ảnh đại diện"
                    className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-[#0084FF] hover:bg-[#0073E6] text-white flex items-center justify-center cursor-pointer ring-2 ring-white dark:ring-[#131822] transition-colors"
                  >
                    <Camera className="w-4 h-4" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUploadProfilePhoto('avatar', f);
                        e.target.value = '';
                      }}
                      hidden
                    />
                  </label>
                )}
              </div>

              <div className="pb-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#0F1419] dark:text-white truncate">
                    {profileUser.name}
                  </h1>
                  {isUserAdmin(profileUser) && (
                    <ShieldCheck className="w-5 h-5 text-[#0084FF] shrink-0" aria-label="Quản trị viên" />
                  )}
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                  {userPosts.length} bài viết · {profileFriends.length} bạn bè
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isOwnProfile ? (
                <button
                  type="button"
                  onClick={openEditModal}
                  className="h-10 px-4 rounded-xl bg-[#F2F4F7] dark:bg-[#1D2432] hover:bg-[#E5E9F0] dark:hover:bg-[#263043] text-[#0F1419] dark:text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                  <span>Chỉnh sửa hồ sơ</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleFriendAction}
                    className={`h-10 px-4 rounded-xl text-sm font-semibold inline-flex items-center gap-2 transition-colors ${
                      isFriend
                        ? 'bg-[#F2F4F7] dark:bg-[#1D2432] text-[#0F1419] dark:text-white hover:bg-red-50 hover:text-red-600'
                        : 'bg-[#0084FF] hover:bg-[#0073E6] text-white'
                    }`}
                  >
                    {isFriend ? (
                      <>
                        <UserMinus className="w-4 h-4" />
                        <span>Hủy kết bạn</span>
                      </>
                    ) : hasIncomingRequest ? (
                      <>
                        <UserCheck className="w-4 h-4" />
                        <span>Chấp nhận</span>
                      </>
                    ) : hasOutgoingRequest ? (
                      <span>Đã gửi lời mời</span>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span>Kết bạn</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onStartChat(profileUser)}
                    className="h-10 px-4 rounded-xl bg-[#F2F4F7] dark:bg-[#1D2432] hover:bg-[#E5E9F0] dark:hover:bg-[#263043] text-[#0F1419] dark:text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Nhắn tin</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {profileUser.bio && (
            <p className="mt-4 text-sm text-[#0F1419] dark:text-slate-200 max-w-2xl leading-relaxed">
              {profileUser.bio}
            </p>
          )}

          {/* Profile Info Details */}
          {(profileUser.work || profileUser.education || profileUser.location || profileUser.website) && (
            <div className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
              {profileUser.work && (
                <span className="inline-flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5" />
                  {profileUser.work}
                </span>
              )}
              {profileUser.education && (
                <span className="inline-flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5" />
                  {profileUser.education}
                </span>
              )}
              {profileUser.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {profileUser.location}
                </span>
              )}
              {profileUser.website && (
                <a
                  href={profileUser.website.startsWith('http') ? profileUser.website : `https://${profileUser.website}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[#0084FF] hover:underline"
                >
                  <Globe className="w-3.5 h-3.5" />
                  {profileUser.website}
                </a>
              )}
            </div>
          )}

          {/* Tabs */}
          <div className="mt-5 pt-2 border-t border-[#EEF0F4] dark:border-[#232B3A] flex items-center gap-1 overflow-x-auto no-scrollbar">
            {(
              [
                { id: 'posts', label: 'Bài viết' },
                { id: 'photos', label: 'Ảnh' },
                { id: 'friends', label: 'Bạn bè' },
                ...(isOwnProfile ? [{ id: 'saved', label: 'Đã lưu' }] : []),
              ] as { id: ProfileTab; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`relative h-10 px-4 text-sm font-semibold whitespace-nowrap transition-colors ${
                  activeTab === t.id
                    ? 'text-[#0084FF]'
                    : 'text-slate-500 dark:text-slate-400 hover:text-[#0F1419] dark:hover:text-white'
                }`}
              >
                {t.label}
                {activeTab === t.id && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-[#0084FF]" />
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Tab Content */}
      <div className="px-3 sm:px-0">
        {activeTab === 'posts' && (
          <div className="max-w-[640px] mx-auto space-y-4">
            {isOwnProfile && (
              <div className="hidden md:block">
                <PostComposer
                  currentUser={currentUser}
                  onOpenAuth={onOpenAuth}
                  onOpenProfile={onOpenProfile}
                  onToast={onToast}
                />
              </div>
            )}
            {userPosts.length === 0 ? (
              <div className="bg-white dark:bg-[#131822] border border-[#E5E7EB] dark:border-[#232B3A] rounded-2xl p-10 text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400">Chưa có bài viết nào.</p>
              </div>
            ) : (
              userPosts.map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
                  currentUser={currentUser}
                  authorUser={profileUser}
                  onOpenProfile={onOpenProfile}
                  onOpenLightbox={onOpenLightbox}
                  onOpenAuth={onOpenAuth}
                  onToast={onToast}
                />
              ))
            )}
          </div>
        )}

        {activeTab === 'photos' && (
          <div className="bg-white dark:bg-[#131822] border border-[#E5E7EB] dark:border-[#232B3A] rounded-2xl p-4">
            {userPhotos.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Chưa có hình ảnh nào.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {userPhotos.map((img, idx) => (
                  <button
                    key={`${img}-${idx}`}
                    type="button"
                    onClick={() => onOpenLightbox(userPhotos, idx)}
                    className="aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900"
                  >
                    <img
                      src={img}
                      alt={`Ảnh ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      className="w-full h-full object-cover hover:scale-105 transition-transform"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'friends' && (
          <div className="bg-white dark:bg-[#131822] border border-[#E5E7EB] dark:border-[#232B3A] rounded-2xl p-4">
            {profileFriends.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Chưa có bạn bè nào.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {profileFriends.map((f) => (
                  <button
                    key={f.uid}
                    type="button"
                    onClick={() => onOpenProfile(f.uid)}
                    className="flex items-center gap-3 p-3 rounded-xl border border-[#EEF0F4] dark:border-[#232B3A] hover:bg-[#F8F9FB] dark:hover:bg-[#1A2130] text-left transition-colors"
                  >
                    <Avatar src={f.avatar} name={f.name} size="md" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#0F1419] dark:text-white truncate">{f.name}</p>
                      {f.bio && <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{f.bio}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'saved' && isOwnProfile && (
          <div className="max-w-[640px] mx-auto space-y-4">
            {savedPosts.length === 0 ? (
              <div className="bg-white dark:bg-[#131822] border border-[#E5E7EB] dark:border-[#232B3A] rounded-2xl p-10 text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400">Bạn chưa lưu bài viết nào.</p>
              </div>
            ) : (
              savedPosts.map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
                  currentUser={currentUser}
                  authorUser={userMap[p.authorUid]}
                  onOpenProfile={onOpenProfile}
                  onOpenLightbox={onOpenLightbox}
                  onOpenAuth={onOpenAuth}
                  onToast={onToast}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {editOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setEditOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md bg-white dark:bg-[#131822] border border-[#E5E7EB] dark:border-[#232B3A] rounded-2xl p-5 shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#EEF0F4] dark:border-[#232B3A]">
              <h3 className="text-base font-bold text-[#0F1419] dark:text-white">Chỉnh sửa hồ sơ</h3>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                aria-label="Đóng"
                className="w-9 h-9 rounded-full hover:bg-slate-100 dark:hover:bg-[#1D2432] flex items-center justify-center text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Tên hiển thị
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl bg-[#F5F6F8] dark:bg-[#0D1118] border border-[#E5E7EB] dark:border-[#232B3A] text-sm focus:outline-none focus:border-[#0084FF]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Tiểu sử
                </label>
                <textarea
                  rows={3}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full p-3 rounded-xl bg-[#F5F6F8] dark:bg-[#0D1118] border border-[#E5E7EB] dark:border-[#232B3A] text-sm resize-none focus:outline-none focus:border-[#0084FF]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Công việc
                </label>
                <input
                  type="text"
                  value={editWork}
                  onChange={(e) => setEditWork(e.target.value)}
                  placeholder="Ví dụ: Kỹ sư phần mềm"
                  className="w-full h-10 px-3.5 rounded-xl bg-[#F5F6F8] dark:bg-[#0D1118] border border-[#E5E7EB] dark:border-[#232B3A] text-sm focus:outline-none focus:border-[#0084FF]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Học vấn
                </label>
                <input
                  type="text"
                  value={editEducation}
                  onChange={(e) => setEditEducation(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl bg-[#F5F6F8] dark:bg-[#0D1118] border border-[#E5E7EB] dark:border-[#232B3A] text-sm focus:outline-none focus:border-[#0084FF]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Sống tại
                </label>
                <input
                  type="text"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  placeholder="Hà Nội, Việt Nam"
                  className="w-full h-10 px-3.5 rounded-xl bg-[#F5F6F8] dark:bg-[#0D1118] border border-[#E5E7EB] dark:border-[#232B3A] text-sm focus:outline-none focus:border-[#0084FF]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Trang web
                </label>
                <input
                  type="text"
                  value={editWebsite}
                  onChange={(e) => setEditWebsite(e.target.value)}
                  placeholder="https://..."
                  className="w-full h-10 px-3.5 rounded-xl bg-[#F5F6F8] dark:bg-[#0D1118] border border-[#E5E7EB] dark:border-[#232B3A] text-sm focus:outline-none focus:border-[#0084FF]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="h-10 px-4 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-[#1D2432]"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="h-10 px-5 rounded-xl bg-[#0084FF] hover:bg-[#0073E6] disabled:opacity-60 text-white text-sm font-semibold"
                >
                  {savingProfile ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
