import { NextResponse } from 'next/server'
import { createClient } from '@/core/infrastructure/supabase/server'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params
  const sid = String(id || '').trim()
  if (!sid) {
    return NextResponse.json({ error: 'Falta id' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let body: { increment_use?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    body = {}
  }

  if (body.increment_use === true || body.increment_use === 1) {
    const { data: row } = await supabase
      .from('user_voice_shortcuts')
      .select('use_count')
      .eq('id', sid)
      .eq('user_id', user.id)
      .maybeSingle()
    const prev = typeof row?.use_count === 'number' ? row.use_count : 0
    const { error } = await supabase
      .from('user_voice_shortcuts')
      .update({ use_count: prev + 1 })
      .eq('id', sid)
      .eq('user_id', user.id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Body no soportado' }, { status: 400 })
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params
  const sid = String(id || '').trim()
  if (!sid) {
    return NextResponse.json({ error: 'Falta id' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { error } = await supabase.from('user_voice_shortcuts').delete().eq('id', sid).eq('user_id', user.id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
