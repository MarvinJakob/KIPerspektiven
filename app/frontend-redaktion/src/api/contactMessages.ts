import { useQuery } from '@tanstack/react-query';
import { client, unwrap } from './client';
import type { components } from './schema';

export type ContactMessage = components['schemas']['ContactMessage'];

// Anforderung #4: Nachrichten von der öffentlichen Kontaktseite.

const CONTACT_MESSAGES_KEY = ['admin', 'contactMessages'] as const;

export const useContactMessages = () =>
  useQuery({
    queryKey: CONTACT_MESSAGES_KEY,
    queryFn: () => unwrap(client.GET('/api/admin/contact-messages')).then((d) => d.items),
  });
