'use client';

import { useState } from 'react';
import { Check, X, Settings2, ChevronRight } from 'lucide-react';
import {
  ALL_DIMENSIONS,
  SongConfigSelection,
  SongConfigDimension,
  resolveSelection,
} from '@/lib/song-config';

interface SongConfigPanelProps {
  /** 当前选择 */
  selection: SongConfigSelection;
  /** 选择更新回调 */
  onChange: (selection: SongConfigSelection) => void;
}

/**
 * 单个维度的单选按钮组
 * 严格互斥：同一维度内只能选中一个，再次点击已选项可取消选择。
 */
function DimensionGroup({
  dimension,
  selectedId,
  onSelect,
}: {
  dimension: SongConfigDimension;
  selectedId: string;
  onSelect: (optionId: string) => void;
}) {
  return (
    <div>
      <label className="block text-deep-navy/80 font-semibold mb-2 text-xl">
        {dimension.title}
      </label>
      {dimension.subtitle && (
        <p className="text-deep-navy/60 text-lg mb-4">{dimension.subtitle}</p>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {dimension.options.map((option) => {
          const isSelected = selectedId === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(isSelected ? '' : option.id)}
              className={`text-center p-5 rounded-lg border-2 cursor-pointer transition-all text-left ${
                isSelected
                  ? 'border-burgundy-wine bg-burgundy-wine/5 shadow-retro-sm'
                  : 'border-deep-navy/30 bg-warm-cream hover:border-deep-navy'
              }`}
            >
              <div className="text-4xl mb-3">{option.icon}</div>
              <h4 className="text-xl font-semibold text-deep-navy mb-1">
                {option.name}
              </h4>
              <p className="text-lg text-deep-navy/60">{option.description}</p>
              {isSelected && (
                <div className="mt-3 w-8 h-8 bg-burgundy-wine rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-5 h-5 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 歌曲配置面板
 *
 * 主表单只显示一个「Customize Your Song」按钮 + 已选摘要，
 * 点击按钮弹出完整配置弹窗，避免占用过多纵向空间。
 */
export default function SongConfigPanel({
  selection,
  onChange,
}: SongConfigPanelProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSelect = (dimensionId: string, optionId: string) => {
    onChange({
      ...selection,
      [dimensionId]: optionId,
    });
  };

  // 统计已选数量
  const resolved = resolveSelection(selection);
  const selectedCount = Object.values(resolved).filter(Boolean).length;
  const totalCount = ALL_DIMENSIONS.length;
  const isComplete = selectedCount === totalCount;

  return (
    <>
      {/* 主表单上的紧凑触发器 */}
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className={`w-full flex items-center justify-between p-5 rounded-lg border-2 transition-all ${
          isComplete
            ? 'border-burgundy-wine bg-burgundy-wine/5 shadow-retro-sm'
            : 'border-deep-navy/30 bg-warm-cream hover:border-deep-navy'
        }`}
      >
        <div className="flex items-center gap-4">
          <Settings2 className={`w-7 h-7 ${isComplete ? 'text-burgundy-wine' : 'text-deep-navy/60'}`} />
          <div className="text-left">
            <div className="text-xl font-bold text-deep-navy">
              {isComplete ? 'Song Settings Ready' : 'Customize Your Song'}
            </div>
            <div className="text-lg text-deep-navy/60">
              {selectedCount}/{totalCount} categories selected
              {isComplete && ' · Click to review or change'}
            </div>
          </div>
        </div>
        <ChevronRight className="w-6 h-6 text-deep-navy/60" />
      </button>

      {/* 维度状态列表：只显示维度名称和完成状态，不显示具体选项内容 */}
      <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2">
        {ALL_DIMENSIONS.map((dim) => {
          const isDimSelected = !!resolved[dim.id as keyof typeof resolved];
          return (
            <div
              key={dim.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-base ${
                isDimSelected
                  ? 'border-burgundy-wine/40 bg-burgundy-wine/5 text-deep-navy'
                  : 'border-deep-navy/20 bg-warm-cream/50 text-deep-navy/50'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${isDimSelected ? 'bg-warm-green text-white' : 'bg-deep-navy/20'}`}>
                {isDimSelected ? '✓' : ''}
              </span>
              <span className="font-medium truncate">{dim.title}</span>
            </div>
          );
        })}
      </div>

      {/* 配置弹窗 */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-deep-navy/60"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white border-2 border-deep-navy rounded-lg shadow-retro-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗头部 */}
            <div className="sticky top-0 bg-white border-b-2 border-deep-navy/20 p-6 flex items-center justify-between z-10">
              <div>
                <h3 className="font-serif text-2xl font-bold text-deep-navy">
                  Fine-Tune Your Song
                </h3>
                <p className="text-deep-navy/60 text-lg">
                  Pick one option from each category below ({selectedCount}/{totalCount} done)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-lg hover:bg-warm-cream transition-colors"
                aria-label="Close"
              >
                <X className="w-7 h-7 text-deep-navy" />
              </button>
            </div>

            {/* 弹窗内容：5 个维度 */}
            <div className="p-6 space-y-8">
              {ALL_DIMENSIONS.map((dimension) => (
                <DimensionGroup
                  key={dimension.id}
                  dimension={dimension}
                  selectedId={selection[dimension.id as keyof SongConfigSelection]}
                  onSelect={(optionId) => handleSelect(dimension.id, optionId)}
                />
              ))}
            </div>

            {/* 弹窗底部 */}
            <div className="sticky bottom-0 bg-white border-t-2 border-deep-navy/20 p-6 flex items-center justify-between gap-4">
              <div className="text-lg text-deep-navy/70">
                {isComplete ? (
                  <span className="flex items-center gap-2 text-warm-green font-semibold">
                    <Check className="w-5 h-5" /> All set! You can close this window.
                  </span>
                ) : (
                  <span>Please select {totalCount - selectedCount} more categor{totalCount - selectedCount === 1 ? 'y' : 'ies'}.</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className={`px-8 py-4 rounded-lg font-bold text-xl border-2 border-deep-navy transition-all ${
                  isComplete
                    ? 'bg-burgundy-wine text-white hover:bg-burgundy-wine/80 shadow-retro-sm'
                    : 'bg-warm-cream text-deep-navy hover:bg-warm-amber'
                }`}
              >
                {isComplete ? 'Done' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
