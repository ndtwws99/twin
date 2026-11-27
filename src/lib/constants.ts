import type { PrivacyLevel, ReactionKey } from '../types';

export interface ReactionMeta {
  key: ReactionKey;
  emoji: string;
  label: string;
  color: string;
}

export const REACTIONS: ReactionMeta[] = [
  { key: 'like', emoji: '👍', label: 'Thích', color: '#0084FF' },
  { key: 'love', emoji: '❤️', label: 'Yêu thích', color: '#FF3040' },
  { key: 'haha', emoji: '😂', label: 'Haha', color: '#EAB308' },
  { key: 'wow', emoji: '😮', label: 'Wow', color: '#F59E0B' },
  { key: 'sad', emoji: '😢', label: 'Buồn', color: '#3B82F6' },
  { key: 'angry', emoji: '😡', label: 'Phẫn nộ', color: '#EF4444' },
];

export const FEELINGS = [
  { value: 'hạnh phúc', label: 'Hạnh phúc', emoji: '😊' },
  { value: 'hào hứng', label: 'Hào hứng', emoji: '🤩' },
  { value: 'đang yêu', label: 'Đang yêu', emoji: '🥰' },
  { value: 'thư giãn', label: 'Thư giãn', emoji: '😌' },
  { value: 'tự hào', label: 'Tự hào', emoji: '😎' },
  { value: 'biết ơn', label: 'Biết ơn', emoji: '🙏' },
  { value: 'tuyệt vời', label: 'Tuyệt vời', emoji: '✨' },
  { value: 'buồn nhẹ', label: 'Buồn nhẹ', emoji: '😔' },
];

export const PRIVACY_OPTIONS: { value: PrivacyLevel; label: string }[] = [
  { value: 'public', label: 'Công khai' },
  { value: 'friends', label: 'Bạn bè' },
  { value: 'private', label: 'Chỉ mình tôi' },
];

export function getReactionMeta(key?: string): ReactionMeta | undefined {
  return REACTIONS.find((r) => r.key === key);
}

export function getPrivacyLabel(privacy?: PrivacyLevel): string {
  return PRIVACY_OPTIONS.find((p) => p.value === privacy)?.label || 'Công khai';
}
