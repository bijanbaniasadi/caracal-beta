export interface AuthPrincipal {
  id: string;
  roles: string[];
}

export function hasRole(principal: AuthPrincipal, role: string): boolean {
  return principal.roles.includes(role);
}

export function readBearerToken(header: string | undefined): string | null {
  if (!header?.startsWith('Bearer ')) {
    return null;
  }

  return header.slice('Bearer '.length).trim() || null;
}
