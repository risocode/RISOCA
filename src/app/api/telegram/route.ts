import {NextResponse} from 'next/server';

// This API route is no longer used by the web application but is kept
// to prevent build errors if other parts of the system still reference it.
// It can be safely removed if no longer needed.

export async function POST(req: Request) {
  return NextResponse.json({status: 'ok', message: 'This endpoint is not actively used.'});
}

export async function GET() {
  return NextResponse.json({status: 'ok', message: 'This endpoint is not actively used.'});
}
