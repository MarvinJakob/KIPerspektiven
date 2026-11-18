import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { client, ME_KEY, unwrap } from './client';
import type { components } from './schema';

export type Profile = components['schemas']['Profile'];

const PROFILE_KEY = ['profile'] as const;

/** Eigenes Profil (Ticket #64). Es gibt nur das Profil der angemeldeten Person. */
export const useProfile = () =>
  useQuery({
    queryKey: PROFILE_KEY,
    queryFn: () => unwrap(client.GET('/api/profile')),
  });

/** Nach einer Profiländerung zeigen Kopfzeile und Profil den neuen Stand. */
function useProfileMutation<T>(fn: (arg: T) => Promise<Profile>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (p) => {
      qc.setQueryData(PROFILE_KEY, p);
      void qc.invalidateQueries({ queryKey: ME_KEY });
    },
  });
}

export const useSaveDisplayName = () =>
  useProfileMutation((displayName: string) => unwrap(client.PATCH('/api/profile', { body: { displayName } })));

export const useUploadAvatar = () =>
  useProfileMutation((file: File) =>
    unwrap(
      client.PUT('/api/profile/avatar', {
        body: { file: file.name },
        bodySerializer: () => {
          const fd = new FormData();
          fd.append('file', file, file.name);
          return fd;
        },
      }),
    ),
  );

export const useChangePassword = () =>
  useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) => unwrap(client.PUT('/api/profile/password', { body })),
  });
