import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { getCurrentUser } from '@/server/auth/request';
import {
  askBetterwayGpt,
  listAiChatThreads,
  listAiDigitalEmployees,
  runAiDigitalEmployee,
  type BetterwayGptMode,
} from '@/server/engines/betterway-gpt-engine';

export async function GET() {
  const db = getDb();
  const user = await getCurrentUser();
  const email = user?.email || 'daniel@betterwaymortgages.com';
  return NextResponse.json({
    threads: listAiChatThreads(db, email),
    digitalEmployees: listAiDigitalEmployees(db),
  });
}

export async function POST(req: Request) {
  try {
    const db = getDb();
    const user = await getCurrentUser();
    const body = (await req.json()) as {
      action?: 'chat' | 'run_agent';
      threadId?: string;
      prompt?: string;
      mode?: BetterwayGptMode;
      agentSlug?: string;
      userEmail?: string;
    };

    const actorEmail = user?.email || body.userEmail || 'daniel@betterwaymortgages.com';

    if (body.action === 'run_agent') {
      const run = runAiDigitalEmployee(db, body.agentSlug || 'rahaba-hr-attendance', actorEmail);
      return NextResponse.json({
        ok: true,
        run,
        digitalEmployees: listAiDigitalEmployees(db),
      });
    }

    const res = askBetterwayGpt(db, {
      threadId: body.threadId,
      userEmail: actorEmail,
      prompt: String(body.prompt || 'Show live mortgage pipeline, bank rates and HR attendance'),
      mode: body.mode || 'LIVE_OS_DATA',
    });

    return NextResponse.json({
      ok: true,
      ...res,
      threads: listAiChatThreads(db, actorEmail),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'BetterwayGPT request failed' },
      { status: 400 },
    );
  }
}
