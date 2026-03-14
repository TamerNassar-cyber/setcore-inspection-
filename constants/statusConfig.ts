import type { JobStatus } from '../types';

export interface StatusStyle {
  label: string;
  bg: string;
  text: string;
  dot: string;
}

/**
 * Returns the display style for a job status badge.
 *
 * Canonical labels (agreed across all roles):
 *   draft     → DRAFT
 *   active    → ACTIVE
 *   completed → FOR REVIEW  (submitted; awaiting supervisor / management approval)
 *   approved  → APPROVED
 *   cancelled → CANCELLED
 */
export function jobStatusConfig(status: JobStatus | string): StatusStyle {
  switch (status as JobStatus) {
    case 'draft':
      return { label: 'DRAFT',      bg: '#1F1A0D', text: '#F59E0B', dot: '#F59E0B' };
    case 'active':
      return { label: 'ACTIVE',     bg: '#0D2B1A', text: '#22C55E', dot: '#22C55E' };
    case 'completed':
      return { label: 'FOR REVIEW', bg: '#1A1F2E', text: '#60A5FA', dot: '#60A5FA' };
    case 'approved':
      return { label: 'APPROVED',   bg: '#1E1208', text: '#FF4715', dot: '#FF4715' };
    case 'cancelled':
      return { label: 'CANCELLED',  bg: '#1A1A1A', text: '#9CA3AF', dot: '#9CA3AF' };
    default:
      return { label: (status as string).toUpperCase(), bg: '#1A1A1A', text: '#9CA3AF', dot: '#9CA3AF' };
  }
}
