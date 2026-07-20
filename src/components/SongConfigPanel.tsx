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
    <div className={`border-2 rounded-lg transition-all ${
      isSelected
        ? 'border-burgundy-wine bg-burgundy-wine/5'
        : 'border-deep-navy/30 bg-warm-cream'
    }`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-5 text-left"
      >
        <div>
          <div className="flex items-center gap-3">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${
              isSelected ? 'bg-warm-green text-white' : 'bg-deep-navy/20 text-deep-navy/40'
            }`}>
              {isSelected ? '✓' : ''}
            </span>
            <h3 className="text-xl font-bold text-deep-navy">
              {dimension.title}
            </h3>
          </div>
          {dimension.subtitle && (
            <p className="text-lg text-deep-navy/60 mt-1 pl-9">
              {dimension.subtitle}
            </p>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-6 h-6 text-deep-navy/60" />
        ) : (
          <ChevronDown className="w-6 h-6 text-deep-navy/60" />
        )}
      </button>

      {isExpanded && (
        <div className="px-5 pb-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {dimension.options.map((option) => {
              const optIsSelected = selectedId === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={optIsSelected}
                  onClick={() => onSelect(optIsSelected ? '' : option.id)}
                  className={`text-center p-5 rounded-lg border-2 cursor-pointer transition-all text-left ${
                    optIsSelected
                      ? 'border-burgundy-wine bg-burgundy-wine/5 shadow-retro-sm'
                      : 'border-deep-navy/30 bg-white hover:border-deep-navy'
                  }`}
                >
                  <div className="text-4xl mb-3">{option.icon}</div>
                  <h4 className="text-xl font-semibold text-deep-navy mb-1">
                    {option.name}
                  </h4>
                  <p className="text-lg text-deep-navy/60">{option.description}</p>
                  {optIsSelected && (
                    <div className="mt-3 w-8 h-8 bg-burgundy-wine rounded-full flex items-center justify-center mx-auto">
                      <Check className="w-5 h-5 text-white" />
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
  const [dimensions, setDimensions] = useState<SongConfigDimension[]>([]);
  const [expandedDimensions, setExpandedDimensions] = useState<Set<string>>(
    new Set()
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchDimensions() {
      try {
        const response = await fetch('/api/song-config');
        const data = await response.json();
        if (data && data.length > 0) {
          setDimensions(data);
          data.forEach((dim: SongConfigDimension) => {
            setExpandedDimensions((prev) => new Set([...prev, dim.id]));
          });
        } else {
          console.log('No dimensions from API, using fallback');
          setDimensions(ALL_DIMENSIONS);
          ALL_DIMENSIONS.forEach((dim) => {
            setExpandedDimensions((prev) => new Set([...prev, dim.id]));
          });
        }
      } catch (error) {
        console.error('Failed to fetch song config:', error);
        setDimensions(ALL_DIMENSIONS);
        ALL_DIMENSIONS.forEach((dim) => {
          setExpandedDimensions((prev) => new Set([...prev, dim.id]));
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchDimensions();

    const timeout = setTimeout(() => {
      if (isLoading) {
        console.log('Fetch timeout, using fallback');
        setDimensions(ALL_DIMENSIONS);
        ALL_DIMENSIONS.forEach((dim) => {
          setExpandedDimensions((prev) => new Set([...prev, dim.id]));
        });
        setIsLoading(false);
      }
    }, 5000);

    return () => clearTimeout(timeout);
  }, [isLoading]);

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

  const selectedCount = Object.values(selection).filter(Boolean).length;
  const totalCount = dimensions.length;
  const isComplete = selectedCount === totalCount;

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-burgundy-wine border-t-transparent" />
        <p className="mt-4 text-xl text-deep-navy/60">Loading song options...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-serif text-2xl font-bold text-deep-navy">
          Customize Your Song
        </h2>
        <span className={`text-lg font-semibold ${
          isComplete ? 'text-warm-green' : 'text-deep-navy/60'
        }`}>
          {selectedCount}/{totalCount} selections
        </span>
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
