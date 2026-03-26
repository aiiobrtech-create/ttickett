import React from 'react';
import { cn } from '../lib/utils';
import { User } from '../types';

interface AvatarSelectorProps {
  currentUser: User;
  onSelect: (avatarUrl: string) => void;
  onClose: () => void;
}

const MALE_SEEDS = Array.from({ length: 10 }, (_, i) => `M${i + 1}`);
const FEMALE_SEEDS = Array.from({ length: 10 }, (_, i) => `F${i + 1}`);

export const AvatarSelector: React.FC<AvatarSelectorProps> = ({ currentUser, onSelect, onClose }) => {
  const isStaff = currentUser.role === 'agent' || currentUser.role === 'admin';
  const accentColor = '5865F2'; // Default accent color

  const getAvatarUrl = (seed: string) => {
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
  };

  const handleSelect = (seed: string) => {
    const url = getAvatarUrl(seed);
    onSelect(url);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-discord-dark rounded-xl border border-discord-border p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <h2 className="text-discord-text font-bold text-lg mb-4">Escolha seu Avatar</h2>
        
        <div className="grid grid-cols-5 gap-4">
          {[...MALE_SEEDS, ...FEMALE_SEEDS].map((seed) => (
            <div key={seed} className="relative group cursor-pointer" onClick={() => handleSelect(seed)}>
              <div className="relative">
                <img 
                  src={getAvatarUrl(seed)} 
                  alt="Avatar" 
                  className={cn(
                    "w-full h-auto rounded-lg border-2 transition-all group-hover:border-discord-accent",
                    isStaff ? "border-4 border-discord-accent" : "border-transparent"
                  )}
                  referrerPolicy="no-referrer"
                />
                {isStaff && (
                  <div className="absolute -top-2 -right-2 bg-discord-accent text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-md border-2 border-discord-dark">
                    aiio
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-discord-darkest text-discord-text rounded hover:bg-discord-hover transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};
