import { Env, json, requireJson, uid, openaiResponses, extractOutputText } from '../_shared';

type Body = { draft: string; context?: string };
const prompt = `You are Project Black Box Coach Mode. Review the user's draft for escalation risk. Do not diagnose. Return JSON: {risk_score:number, summary:string, risk_drivers:string[], validation_gaps:string[], what_they_may_hear:string[], what_to_avoid:string[], suggested_rewrite:string, next_best_action:string}`;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await requireJson<Body>(request);
    if (!body.draft?.trim()) return json({ error: 'draft required' }, 400);
    const ai = await openaiResponses(env, {
      model: 'gpt-5.5',
      input: [{ role: 'system', content: prompt }, { role: 'user', content: `Context:\n${body.context || ''}\n\nDraft:\n${body.draft}` }],
      text: { format: { type: 'json_object' } }
    });
    const report = JSON.parse(extractOutputText(ai));
    const id = uid('coach');
    await env.DB.prepare('INSERT INTO coaching_reports (id,draft_text,risk_score,report_json) VALUES (?,?,?,?)')
      .bind(id, body.draft, report.risk_score ?? 0, JSON.stringify(report)).run();
    return json({ ok: true, coaching_report_id: id, report });
  } catch (err: any) {
    return json({ error: err.message || 'Coach failed' }, 500);
  }
};
