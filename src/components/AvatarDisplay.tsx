import React from 'react';
import { cn } from '../lib/utils';
import { User } from '../types';

interface AvatarDisplayProps {
  user: User;
  className?: string;
  showBadge?: boolean;
}

export const AvatarDisplay: React.FC<AvatarDisplayProps> = ({ user, className, showBadge = true }) => {
  const isStaff = user.role === 'agent' || user.role === 'admin';
  const [imgError, setImgError] = React.useState(false);

  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  if (!user.avatar || imgError) {
    return (
      <div className={cn("rounded-full border-2 border-discord-accent bg-discord-accent/20 flex items-center justify-center text-discord-accent font-bold text-xs", className)}>
        {initials}
      </div>
    );
  }
  
  return (
    <div className={cn("relative inline-block", className)}>
      <img 
        src={user.avatar} 
        alt={user.name} 
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className={cn(
          "rounded-full border-2 transition-all",
          isStaff && showBadge ? "border-4 border-discord-accent" : "border-transparent"
        )}
      />
      {isStaff && showBadge && (
        <div className="absolute -top-1 -right-1 bg-discord-accent text-white text-[8px] font-black px-1 py-0.5 rounded-full shadow-md border-2 border-discord-dark">
          aiio
        </div>
      )}
    </div>
  );
};
