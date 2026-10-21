import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '@techfix/domain';
import { SignJWT, jwtVerify } from 'jose';
import { ENV, type Env } from '../config/env.js';

export interface AccessClaims {
  sub: string;
  role: string;
}

export const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');

@Injectable()
export class TokenService {
  private readonly key: Uint8Array;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.key = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
  }

  signAccess(userId: string, role: string): Promise<string> {
    return new SignJWT({ role })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuer('techfix')
      .setIssuedAt()
      .setExpirationTime(`${this.env.ACCESS_TOKEN_TTL_MINUTES}m`)
      .sign(this.key);
  }

  async verifyAccess(token: string): Promise<AccessClaims> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: 'techfix',
        algorithms: ['HS256'],
      });
      if (!payload.sub) throw new Error('no subject');
      return { sub: payload.sub, role: String(payload['role']) };
    } catch {
      throw new DomainError('UNAUTHORIZED');
    }
  }

  /** Opaque refresh token; only its hash is stored. */
  newRefresh(): { token: string; hash: string; familyId: () => string; expiresAt: Date } {
    const token = randomBytes(32).toString('base64url');
    return {
      token,
      hash: sha256(token),
      familyId: randomUUID,
      expiresAt: new Date(Date.now() + this.env.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
    };
  }
}
