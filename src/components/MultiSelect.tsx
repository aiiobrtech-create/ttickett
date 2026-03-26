import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface Option {
  id: string;
  name: string;
}

interface MultiSelectProps {
  options: Option[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  placeholder?: string;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
  options,
  selectedIds,
  onChange,
  placeholder = 'Selecione as opções...'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(selectedId => selectedId !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const removeOption = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onChange(selectedIds.filter(selectedId => selectedId !== id));
  };

  const selectedOptions = options.filter(opt => selectedIds.includes(opt.id));

  return (
    <div className="relative" ref={containerRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full min-h-[46px] bg-discord-darkest border rounded-md p-2 text-sm text-discord-text cursor-pointer flex flex-wrap gap-2 items-center transition-all",
          isOpen ? "border-discord-accent ring-1 ring-discord-accent" : "border-discord-border hover:border-discord-muted"
        )}
      >
        {selectedOptions.length === 0 ? (
          <span className="text-discord-muted px-1">{placeholder}</span>
        ) : (
          selectedOptions.map(opt => (
            <span
              key={opt.id}
              className="bg-discord-dark border border-discord-border text-discord-text text-xs px-2 py-1 rounded flex items-center gap-1"
            >
              {opt.name}
              <button
                type="button"
                onClick={(e) => removeOption(e, opt.id)}
                className="text-discord-muted hover:text-red-400 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))
        )}
        <div className="ml-auto px-1">
          <ChevronDown className={cn("w-4 h-4 text-discord-muted transition-transform", isOpen && "rotate-180")} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-discord-darker border border-discord-border rounded-md shadow-xl max-h-60 overflow-y-auto">
          {options.length === 0 ? (
            <div className="p-3 text-sm text-discord-muted text-center">Nenhuma opção disponível</div>
          ) : (
            options.map(opt => {
              const isSelected = selectedIds.includes(opt.id);
              return (
                <div
                  key={opt.id}
                  onClick={() => toggleOption(opt.id)}
                  className="flex items-center gap-2 px-3 py-2.5 hover:bg-discord-hover cursor-pointer transition-colors"
                >
                  <div className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0",
                    isSelected ? "bg-discord-accent border-discord-accent" : "border-discord-muted bg-discord-darkest"
                  )}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-sm text-discord-text truncate">{opt.name}</span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
