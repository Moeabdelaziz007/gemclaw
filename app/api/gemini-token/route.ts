export const dynamic = "force-dynamic";
import {NextRequest, NextResponse} from 'next/server';

// In-memory rate limiting map
// key: IP, value: { count, resetTime }
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export async function GET(request: NextRequest) {
  // Extract user IP or fallback to localhost
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxRequests = 30;

  let limit = rateLimitMap.get(ip);

  // Reset check
  if (limit && now > limit.resetTime) {
    limit = undefined;
    rateLimitMap.delete(ip);
  }

  if (!limit) {
    limit = { count: 1, resetTime: now + windowMs };
    rateLimitMap.set(ip, limit);
  } else {
    limit.count++;
  }

  // Enforcement
  if (limit.count > maxRequests) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Too many requests to Gemini Token proxy.' },
      { 
        status: 429, 
        headers: { 
          'Retry-After': Math.ceil((limit.resetTime - now) / 1000).toString(),
          'X-RateLimit-Limit': maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': limit.resetTime.toString()
        } 
      }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('❌ [Security] GEMINI_API_KEY environment variable is not configured.');
    return NextResponse.json(
      { error: 'Server authentication configuration error.' }, 
      { status: 500 }
    );
  }

  // Return sovereign token bundle
  return NextResponse.json({
    token: apiKey,
    expiresAt: now + (3600 * 1000), // 1 hour advisory
  }, {
    headers: {
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': (maxRequests - limit.count).toString(),
      'Cache-Control': 'no-store, max-age=0'
    }
  });
}

// Mark as dynamic since it depends on request headers and env vars
