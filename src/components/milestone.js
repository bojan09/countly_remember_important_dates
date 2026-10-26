import { t } from '../i18n/index.js';

/** Human label of a milestone from events/milestones.js, e.g. "100 days to go" or "1 year since". */
export function milestoneLabel(m) {
  if (m.kind === 'togo') {
    if (m.years) return t('milestones.togo.year');
    if (m.days === 1) return t('milestones.togo.tomorrow');
    if (m.days === 7) return t('milestones.togo.week');
    return t('milestones.togo.days', { count: m.days });
  }
  if (m.years) return t('milestones.since.years', { count: m.years });
  if (m.days === 7) return t('milestones.since.week');
  return t('milestones.since.days', { count: m.days });
}
