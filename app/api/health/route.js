import { NextResponse } from 'next/server';

export async function GET() {
  const API_KEY = process.env.PREDICT_API_KEY;

  return NextResponse.json({
    success: true,
    configured: !!API_KEY,
    version: '1.0.0'
  });
}
