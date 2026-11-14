import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { client, unwrap } from './client';
import type { components } from './schema';

export type Period = components['schemas']['StatisticsPeriod'];
export type PageViewStats = components['schemas']['PageViewStats'];
export type ReadinessResultPage = components['schemas']['ReadinessResultPage'];
export type ReadinessResult = components['schemas']['ReadinessResult'];

// Seitenaufrufe wechseln ohne Platzhalterdaten, damit alte Werte nicht als neuer Zeitraum erscheinen (#139).

export const usePageViews = (period: Period) =>
  useQuery({
    queryKey: ['admin', 'statistics', 'pageViews', period],
    queryFn: () => unwrap(client.GET('/api/admin/statistics/page-views', { params: { query: { period } } })),
  });

export const useReadinessResults = (period: Period, page: number) =>
  useQuery({
    queryKey: ['admin', 'statistics', 'readinessResults', period, page],
    queryFn: () => unwrap(client.GET('/api/admin/statistics/readiness-results', { params: { query: { period, page } } })),
    placeholderData: keepPreviousData,
  });
