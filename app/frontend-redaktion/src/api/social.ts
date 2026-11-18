import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { client, unwrap } from './client';
import type { LinkedInSettings } from '../lib/linkedin';
import type { Lang } from './posts';

const LINKEDIN_KEY = ['admin', 'social', 'linkedin'] as const;

/** LinkedIn-Einstellungen (Ticket #85, nur Admin). Enthalten nie das Zugriffstoken. */
export const useLinkedInSettings = () =>
  useQuery({
    queryKey: LINKEDIN_KEY,
    queryFn: () => unwrap(client.GET('/api/admin/social/linkedin')),
  });

export const useSaveLinkedInSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { enabled: boolean; preferredLang: Lang }) => unwrap(client.PUT('/api/admin/social/linkedin', { body })),
    onSuccess: (s: LinkedInSettings) => qc.setQueryData(LINKEDIN_KEY, s),
  });
};

/** Beginnt die Autorisierung und führt zu LinkedIn. Der Rückruf kehrt zur Einstellungsseite zurück. */
export const useConnectLinkedIn = () =>
  useMutation({
    mutationFn: () => unwrap(client.POST('/api/admin/social/linkedin/authorize')),
    onSuccess: (r) => window.location.assign(r.authorizationUrl),
  });

export const useDisconnectLinkedIn = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { response } = await client.DELETE('/api/admin/social/linkedin/connection');
      if (!response.ok) throw new Error(response.statusText);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: LINKEDIN_KEY }),
  });
};
