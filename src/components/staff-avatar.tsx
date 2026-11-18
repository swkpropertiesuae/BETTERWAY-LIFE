import { getStaffAvatarUrl, getStaffInitials } from '@/lib/staff-directory';

export function StaffAvatar({
  name,
  email,
  avatarUrl,
  size = 36,
  className = '',
}: {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const resolvedUrl = avatarUrl || getStaffAvatarUrl(email) || getStaffAvatarUrl(name);
  const initials = getStaffInitials(name || email);

  if (resolvedUrl) {
    return (
      <img
        src={resolvedUrl}
        alt={name || email || 'Staff Member'}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={`rounded-full object-cover object-top shrink-0 border border-[#d7b04e]/50 shadow-xs bg-[#021125] ${className}`}
      />
    );
  }

  return (
    <span
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.34)) }}
      className={`inline-flex items-center justify-center rounded-full bg-[#021125] text-[#d7b04e] font-bold shrink-0 border border-[#d7b04e]/40 select-none ${className}`}
      aria-label={name || email || 'Staff Member'}
    >
      {initials}
    </span>
  );
}
