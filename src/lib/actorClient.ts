// Client-side counterpart of getActor(): shared member/admin components pass `asAdmin` through here.
export function actorInit(asAdmin: boolean | undefined, init: RequestInit = {}): RequestInit {
  if (!asAdmin) return init;
  return { ...init, headers: { ...(init.headers as Record<string, string> | undefined), 'x-pt-actor': 'admin' } };
}
