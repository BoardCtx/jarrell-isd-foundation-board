'use client';

/**
 * Reusable Avatar component
 * - Shows the user's uploaded avatar image if available
 * - Falls back to colored initials circle derived from user's name
 * - Three sizes: sm (32px), md (40px), lg (80px)
 */

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: { container: 'w-8 h-8', text: 'text-xs' },
  md: { container: 'w-10 h-10', text: 'text-sm' },
  lg: { container: 'w-20 h-20', text: 'text-2xl' },
};

// Deterministic color from name — always the same color for the same person
const avatarColors = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-purple-500',
  'bg-cyan-500',
  'bg-orange-500',
  'bg-teal-500',
  'bg-indigo-500',
  'bg-pink-500',
];

function getColorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (parts[0]?.[0] || '?').toUpperCase();
}

export default function Avatar({ src, name, size = 'md', className = '' }: AvatarProps) {
  const { container, text } = sizeMap[size];

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${container} rounded-full object-cover flex-shrink-0 ${className}`}
      />
    );
  }

  const color = getColorFromName(name);
  const initials = getInitials(name);

  return (
    <div
      className={`${container} ${color} rounded-full flex items-center justify-center flex-shrink-0 ${className}`}
      title={name}
    >
      <span className={`${text} font-semibold text-white leading-none`}>
        {initials}
      </span>
    </div>
  );
}

// Export helpers for use in other components
export { getInitials, getColorFromName };
