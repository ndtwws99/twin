import { useMemo } from 'react';
import { arrayRemove, arrayUnion, doc, updateDoc } from 'firebase/firestore';
import { MessageCircle, UserCheck, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { Avatar } from './Avatar';
import {
  db,
  friendlyError,
  getUserPresence,
  isGuestUser,
  pushNotification,
  unfriendUser,
} from '../lib/firebase';
import type { TwinUser } from '../types';

interface FriendsViewProps {
  currentUser: TwinUser | null;
  users: TwinUser[];
  userMap: Record<string, TwinUser>;
  onOpenProfile: (uid: string) => void;
  onStartChat: (peer: TwinUser) => void;
  onOpenAuth: () => void;
  onToast: (msg: string) => void;
}

export function FriendsView({
  currentUser,
  users,
  userMap,
  onOpenProfile,
  onStartChat,
  onOpenAuth,
  onToast,
}: FriendsViewProps) {
  const guest = isGuestUser(currentUser);
  const myFriends = useMemo(
    () => (Array.isArray(currentUser?.friends) ? currentUser.friends : []),
    [currentUser]
  );
  const myRequests = useMemo(
    () => (Array.isArray(currentUser?.friendRequests) ? currentUser.friendRequests : []),
    [currentUser]
  );

  const requestUsers = useMemo(
    () => myRequests.map((uid) => userMap[uid]).filter(Boolean),
    [myRequests, userMap]
  );

  const friendUsers = useMemo(
    () => myFriends.map((uid) => userMap[uid]).filter(Boolean),
    [myFriends, userMap]
  );

  const suggestedUsers = useMemo(
    () =>
      users.filter(
        (u) =>
          u.uid !== currentUser?.uid &&
          !myFriends.includes(u.uid) &&
          !myRequests.includes(u.uid)
      ),
    [users, currentUser?.uid, myFriends, myRequests]
  );

  const acceptRequest = async (u: TwinUser) => {
    if (!currentUser || guest) return onOpenAuth();
    try {
      await Promise.all([
        updateDoc(doc(db, 'users', currentUser.uid), {
          friendRequests: arrayRemove(u.uid),
          friends: arrayUnion(u.uid),
        }),
        updateDoc(doc(db, 'users', u.uid), {
          friends: arrayUnion(currentUser.uid),
          friendRequests: arrayRemove(currentUser.uid),
        }),
      ]);
      pushNotification(u.uid, {
        fromUid: currentUser.uid,
        fromName: currentUser.name,
        fromAvatar: currentUser.avatar,
        type: 'friend',
        text: 'đã chấp nhận lời mời kết bạn của bạn.',
      }).catch(() => {});
      onToast(`Đã trở thành bạn bè với ${u.name}.`);
    } catch (err) {
      onToast(friendlyError(err));
    }
  };

  const declineRequest = async (u: TwinUser) => {
    if (!currentUser || guest) return;
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        friendRequests: arrayRemove(u.uid),
      });
      onToast('Đã từ chối lời mời kết bạn.');
    } catch (err) {
      onToast(friendlyError(err));
    }
  };

  const sendRequest = async (u: TwinUser) => {
    if (!currentUser || guest) {
      onToast('Đăng nhập tài khoản để gửi lời mời kết bạn.');
      onOpenAuth();
      return;
    }
    try {
      await updateDoc(doc(db, 'users', u.uid), {
        friendRequests: arrayUnion(currentUser.uid),
      });
      pushNotification(u.uid, {
        fromUid: currentUser.uid,
        fromName: currentUser.name,
        fromAvatar: currentUser.avatar,
        type: 'friend',
        text: 'đã gửi cho bạn lời mời kết bạn.',
      }).catch(() => {});
      onToast(`Đã gửi lời mời tới ${u.name}.`);
    } catch (err) {
      onToast(friendlyError(err));
    }
  };

  const handleUnfriend = async (u: TwinUser) => {
    if (!currentUser || guest) return;
    try {
      await unfriendUser(currentUser.uid, u.uid);
      onToast(`Đã hủy kết bạn với ${u.name}.`);
    } catch (err) {
      onToast(friendlyError(err));
    }
  };

  return (
    <div className="max-w-[920px] mx-auto px-3 sm:px-5 pt-4 pb-20 md:pb-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0F1419] dark:text-white">Bạn bè</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            {friendUsers.length} bạn bè · {requestUsers.length} lời mời đang chờ
          </p>
        </div>
      </div>

      {/* Incoming Friend Requests */}
      {requestUsers.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-[#0F1419] dark:text-white">Lời mời kết bạn</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {requestUsers.map((u) => (
              <div
                key={u.uid}
                className="bg-white dark:bg-[#131822] border border-[#E5E7EB] dark:border-[#232B3A] rounded-2xl p-4 space-y-3"
              >
                <button
                  type="button"
                  onClick={() => onOpenProfile(u.uid)}
                  className="flex items-center gap-3 text-left w-full"
                >
                  <Avatar src={u.avatar} name={u.name} size="md" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#0F1419] dark:text-white truncate">{u.name}</p>
                    {u.bio && <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{u.bio}</p>}
                  </div>
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => acceptRequest(u)}
                    className="h-9 rounded-xl bg-[#0084FF] hover:bg-[#0073E6] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    Chấp nhận
                  </button>
                  <button
                    type="button"
                    onClick={() => declineRequest(u)}
                    className="h-9 rounded-xl bg-[#F2F4F7] dark:bg-[#1D2432] hover:bg-slate-200 dark:hover:bg-[#263043] text-xs font-semibold text-slate-600 dark:text-slate-300 inline-flex items-center justify-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    Xóa
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Current Friends */}
      {!guest && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-[#0F1419] dark:text-white">
            Danh sách bạn bè ({friendUsers.length})
          </h2>
          {friendUsers.length === 0 ? (
            <div className="bg-white dark:bg-[#131822] border border-[#E5E7EB] dark:border-[#232B3A] rounded-2xl p-8 text-center">
              <Users className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Bạn chưa kết bạn với ai. Hãy khám phá mọi người bên dưới.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {friendUsers.map((u) => {
                const presence = getUserPresence(u);
                return (
                  <div
                    key={u.uid}
                    className="bg-white dark:bg-[#131822] border border-[#E5E7EB] dark:border-[#232B3A] rounded-2xl p-3.5 flex items-center justify-between gap-3"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenProfile(u.uid)}
                      className="flex items-center gap-3 min-w-0 text-left"
                    >
                      <Avatar src={u.avatar} name={u.name} size="md" online={presence.online} />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#0F1419] dark:text-white truncate">{u.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {presence.label || u.bio || 'Bạn bè'}
                        </p>
                      </div>
                    </button>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onStartChat(u)}
                        aria-label="Nhắn tin"
                        className="w-9 h-9 rounded-xl bg-[#F2F4F7] dark:bg-[#1D2432] hover:bg-[#0084FF] hover:text-white text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUnfriend(u)}
                        aria-label="Hủy kết bạn"
                        className="w-9 h-9 rounded-xl bg-[#F2F4F7] dark:bg-[#1D2432] hover:bg-red-50 hover:text-red-600 text-slate-500 flex items-center justify-center transition-colors"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* People You May Know */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-[#0F1419] dark:text-white">Gợi ý kết bạn</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {suggestedUsers.map((u) => {
            const sent = Boolean(currentUser && Array.isArray(u.friendRequests) && u.friendRequests.includes(currentUser.uid));
            return (
              <div
                key={u.uid}
                className="bg-white dark:bg-[#131822] border border-[#E5E7EB] dark:border-[#232B3A] rounded-2xl p-4 flex flex-col justify-between gap-3"
              >
                <button
                  type="button"
                  onClick={() => onOpenProfile(u.uid)}
                  className="flex items-center gap-3 text-left"
                >
                  <Avatar src={u.avatar} name={u.name} size="md" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#0F1419] dark:text-white truncate">{u.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {u.bio || 'Thành viên Twin'}
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  disabled={sent}
                  onClick={() => sendRequest(u)}
                  className="w-full h-9 rounded-xl bg-[#0084FF] hover:bg-[#0073E6] disabled:bg-[#F2F4F7] disabled:text-slate-500 dark:disabled:bg-[#1D2432] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{sent ? 'Đã gửi lời mời' : 'Thêm bạn bè'}</span>
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
