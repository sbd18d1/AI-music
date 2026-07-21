'use client';

import { useState, useEffect } from 'react';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { SongConfigSelection, ALL_DIMENSIONS } from '@/lib/song-config';

export interface SongConfigOption {
  id: string;
  icon: string;
  name: string;
  description: string;
  styleTag?: string;
  lyricInstruction?: string;
  genreValue?: string;
}

export interface SongConfigDimension {
  id: string;
  title: string;
  subtitle?: string;
  options: SongConfigOption[];
}

interface SongConfigPanelProps {
  selection: SongConfigSelection;
  onChange: (selection: SongConfigSelection) => void;
}

function DimensionGroup({
  dimension,
  selectedId,
  onSelect,
  isExpanded,
  onToggle,
}: {
  dimension: SongConfigDimension;
  selectedId: string;
  onSelect: (optionId: string) => void;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const isSelected = !!selectedId;

  return (
    <div className={`border-2 rounded-2xl transition-all ${
      isSelected
        ? 'border-primary bg-primary/5'
        : 'border-base-300 bg-base-100'
    }`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div>
          <div>
            <h3 className="text-base font-bold text-base-content">
              {dimension.title}
            </h3>
            {dimension.subtitle && (
              <p className="text-sm text-base-content/60 mt-1">
                {dimension.subtitle}
              </p>
            )}
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-base-content/60" />
        ) : (
          <ChevronDown className="w-5 h-5 text-base-content/60" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {dimension.options.map((option) => {
              const optIsSelected = selectedId === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={optIsSelected}
                  onClick={() => onSelect(optIsSelected ? '' : option.id)}
                  className={`text-center p-4 rounded-xl border-2 cursor-pointer transition-all text-left ${
                    optIsSelected
                      ? 'border-primary bg-primary/10 shadow-md'
                      : 'border-base-300 bg-white hover:border-primary/50'
                  }`}
                >
                  <div className="text-2xl mb-2">{option.icon}</div>
                  <h4 className="text-sm font-semibold text-base-content mb-1">
                    {option.name}
                  </h4>
                  <p className="text-xs text-base-content/60">{option.description}</p>
                  {optIsSelected && (
                    <div className="mt-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center mx-auto">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SongConfigPanel({
  selection,
  onChange,
}: SongConfigPanelProps) {
  const [dimensions, setDimensions] = useState<SongConfigDimension[]>(ALL_DIMENSIONS);
  const [expandedDimensions, setExpandedDimensions] = useState<Set<string>>(new Set());

  useEffect(() => {
    let isMounted = true;
    
    async function fetchDimensions() {
      try {
        const response = await fetch('/api/song-config');
        const data = await response.json();
        if (isMounted && data && data.length > 0) {
          setDimensions(data);
        }
      } catch (error) {
        console.log('Using fallback dimensions');
      }
    }

    fetchDimensions();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSelect = (dimensionId: string, optionId: string) => {
    onChange({
      ...selection,
      [dimensionId]: optionId,
    });
  };

  const toggleDimension = (dimensionId: string) => {
    setExpandedDimensions((prev) => {
      const next = new Set(prev);
      if (next.has(dimensionId)) {
        next.delete(dimensionId);
      } else {
        next.add(dimensionId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="mb-5">
        <h2 className="font-serif text-lg font-bold text-base-content">
          Customize Your Song
        </h2>
      </div>

      {dimensions.map((dimension) => (
        <DimensionGroup
          key={dimension.id}
          dimension={dimension}
          selectedId={selection[dimension.id as keyof SongConfigSelection] || ''}
          onSelect={(optionId) => handleSelect(dimension.id, optionId)}
          isExpanded={expandedDimensions.has(dimension.id)}
          onToggle={() => toggleDimension(dimension.id)}
        />
      ))}
    </div>
  );
}