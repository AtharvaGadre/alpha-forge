// ============================================================================
// ALPHAFORGE ATMOSPHERE — FORECAST TIME & ANIMATION CONTROLLER
// Provides intuitive human-friendly time labels (Yesterday, Today, Tomorrow,
// Next 7 days) alongside technical UTC timestamps in Advanced mode.
// ============================================================================

export interface ForecastTimelineStepPreset {
  id: string;
  label: string;
  shortLabel: string;
  offsetHours: number;
  kind: 'OBSERVATION' | 'CURRENT' | 'FORECAST';
}

export const TIMELINE_PRESET_STEPS: ForecastTimelineStepPreset[] = [
  {
    id: 'YESTERDAY',
    label: 'Yesterday',
    shortLabel: 'Yesterday',
    offsetHours: -24,
    kind: 'OBSERVATION',
  },
  {
    id: 'TODAY_NOW',
    label: 'Today (Live)',
    shortLabel: 'Today',
    offsetHours: 0,
    kind: 'CURRENT',
  },
  {
    id: 'TOMORROW',
    label: 'Tomorrow',
    shortLabel: 'Tomorrow',
    offsetHours: 24,
    kind: 'FORECAST',
  },
  {
    id: 'DAY_3',
    label: 'In 3 Days',
    shortLabel: '+3 Days',
    offsetHours: 72,
    kind: 'FORECAST',
  },
  {
    id: 'NEXT_7_DAYS',
    label: 'Next 7 Days',
    shortLabel: 'Next 7d',
    offsetHours: 168,
    kind: 'FORECAST',
  },
];

export function formatOffsetHoursToHumanLabel(offsetHours: number): {
  humanLabel: string;
  regimeBadge: 'Observed History' | 'Current Conditions' | 'Model Forecast';
  validTimeFormatted: string;
  technicalUtcLabel: string;
} {
  const validDate = new Date(Date.now() + offsetHours * 3_600_000);
  const validTimeFormatted = validDate.toLocaleString('en-GB', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const technicalUtcLabel = `${validDate.toISOString().slice(0, 16).replace('T', ' ')} UTC (${
    offsetHours >= 0 ? `+${offsetHours}h` : `${offsetHours}h`
  })`;

  if (offsetHours === 0) {
    return {
      humanLabel: 'Today (Live)',
      regimeBadge: 'Current Conditions',
      validTimeFormatted,
      technicalUtcLabel,
    };
  }
  if (offsetHours < 0) {
    const absHours = Math.abs(offsetHours);
    const humanLabel =
      absHours === 24
        ? 'Yesterday'
        : absHours < 24
        ? `${absHours} hours ago`
        : `${Math.round(absHours / 24)} days ago`;
    return {
      humanLabel,
      regimeBadge: 'Observed History',
      validTimeFormatted,
      technicalUtcLabel,
    };
  }
  const humanLabel =
    offsetHours === 24
      ? 'Tomorrow'
      : offsetHours < 48
      ? `In ${offsetHours} hours`
      : offsetHours === 168
      ? 'Next 7 Days'
      : `In ${Math.round(offsetHours / 24)} days`;
  return {
    humanLabel,
    regimeBadge: 'Model Forecast',
    validTimeFormatted,
    technicalUtcLabel,
  };
}
