import { NextResponse } from 'next/server';
import { fetchAuroraAvailability, type AuroraAvailability } from '../../../../lib/aurora';

export const dynamic = 'force-dynamic';
let cached: AuroraAvailability | undefined;
let pending: Promise<AuroraAvailability> | undefined;

export async function GET() {
  try {
    if (!cached || Date.now() - Date.parse(cached.checkedAt) > 60_000) {
      // Coalesce concurrent visitors; do not turn the public page into an
      // unrestricted upstream proxy. No user-selected URL or wallet is accepted.
      pending ??= fetchAuroraAvailability().finally(() => { pending = undefined; });
      cached = await pending;
    }
    return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ status: 'unavailable', fundingEnabled: false, error: 'Could not verify the Aurora route. No deposits are enabled.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
