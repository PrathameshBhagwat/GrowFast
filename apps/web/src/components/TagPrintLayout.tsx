import React from 'react';
import { PhysicalTag, PhysicalTagData } from './PhysicalTag';
import { TagCalibrationCard } from './TagCalibrationCard';
import type { TagDesignConfig } from '@growfast/shared-types';

export interface TagPrintLayoutProps {
  tags?: PhysicalTagData[];
  isCalibration?: boolean;
  id?: string;
  design?: TagDesignConfig;
}

/**
 * Print-only DOM container for physical 40×40 mm washable cloth tags.
 * Designed to be targeted by `@media print` via `#printable-tags`.
 * Sorts tags deterministically by unitNumber ascending.
 * Strictly maintains 40mm × 40mm dimensions without hardware-offset margins.
 */
export const TagPrintLayout: React.FC<TagPrintLayoutProps> = ({
  tags = [],
  isCalibration = false,
  id = 'printable-tags',
  design,
}) => {
  // If calibration mode is active, render exactly one 40x40mm calibration card
  if (isCalibration) {
    return (
      <div id={id} className="printable-tags-container" data-testid="printable-tags-container">
        <div
          className="printable-tag-wrapper"
          style={{
            pageBreakInside: 'avoid',
            breakInside: 'avoid',
            pageBreakAfter: 'avoid',
            breakAfter: 'avoid',
            margin: '0 auto',
            width: '40mm',
            height: '40mm',
          }}
        >
          <TagCalibrationCard isPrintMode={true} />
        </div>
      </div>
    );
  }

  // Sort deterministically: unitNumber ascending (1, 2, 3...)
  const sortedTags = [...tags].sort((a, b) => a.unitNumber - b.unitNumber);

  return (
    <div id={id} className="printable-tags-container" data-testid="printable-tags-container">
      {sortedTags.map((tag, idx) => (
        <div
          key={`${tag.tagId}-${tag.unitNumber}`}
          className="printable-tag-wrapper"
          style={{
            pageBreakInside: 'avoid',
            breakInside: 'avoid',
            pageBreakAfter: idx === sortedTags.length - 1 ? 'avoid' : 'always',
            breakAfter: idx === sortedTags.length - 1 ? 'avoid' : 'page',
            margin: '0 auto',
            width: '40mm',
            height: '40mm',
          }}
        >
          <PhysicalTag data={tag} isPrintMode={true} design={design} />
        </div>
      ))}
    </div>
  );
};
