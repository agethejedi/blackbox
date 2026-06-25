import { Env, json, requireJson, uid, openaiResponses, extractOutputText, readConversationText } from './_shared';

type Body = { conversation_id: string };

const systemPrompt = `You are Project Black Box, a relationship communication intelligence system. Do not decide who is right. Do not diagnose. Analyze observable communication patterns. Return strict JSON with this schema:
{
  "conversation_quality": number,
  "escalation_score": number,
  "validation_score": number,
  "collaboration_score": number,
  "topic_drift_score": number,
  "resolution_probability": number,
  "outcome": "resolved"|"escalated"|"unresolved"|"deferred",
  "summary": string,
  "topics": [{"name": string, "theme": string, "first_message_position": number, "last_message_position": number}],
  "horsemen": {"relationship": {"criticism": number, "defensiveness": number, "contempt": number, "stonewalling": number}, "speakers": [{"speaker": string, "criticism": number, "defensiveness": number, "contempt": number, "stonewalling": number, "evidence": [{"pattern": string, "quote": string, "confidence": number}]}]},
  "repair": {"relationship": {"repair_score": number, "repair_attempts": number, "successful_repairs": number}, "speakers": [{"speaker": string, "validation": number, "accountability": number, "appreciation": number, "compromise": number, "reconnection": number, "repair_attempts": number, "successful_repairs": number, "evidence": [{"type": string, "quote": string, "confidence": number}]}]},
  "unanswered_questions": [string],
  "topic_drift_events": [{"from": string, "to": string, "confidence": number}],
  "coaching_recommendations": [string]
}`;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const { conversation_id } = await requireJson<Body>(request);
    if (!conversation_id) return json({ error: 'conversation_id required' }, 400);
    const text = await readConversationText(env, conversation_id);
    if (!text) return json({ error: 'Conversation has no messages' }, 404);
    const ai = await openaiResponses(env, {
      model: 'gpt-5.5',
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze this conversation:\n\n${text}` }
      ],
      text: { format: { type: 'json_object' } }
    });
    const report = JSON.parse(extractOutputText(ai));
    const runId = uid('run');
    await env.DB.prepare(`INSERT INTO analysis_runs (id, conversation_id, conversation_quality, escalation_score, validation_score, collaboration_score, topic_drift_score, resolution_probability, outcome, report_json) VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .bind(runId, conversation_id, report.conversation_quality ?? 0, report.escalation_score ?? 0, report.validation_score ?? 0, report.collaboration_score ?? 0, report.topic_drift_score ?? 0, report.resolution_probability ?? 0, report.outcome || 'unresolved', JSON.stringify(report)).run();
    const rel = report.horsemen?.relationship || {};
    await env.DB.prepare(`INSERT INTO horsemen_scores (id, analysis_run_id, conversation_id, speaker, criticism, defensiveness, contempt, stonewalling, evidence_json) VALUES (?,?,?,?,?,?,?,?,?)`)
      .bind(uid('horse'), runId, conversation_id, 'Relationship', rel.criticism ?? 0, rel.defensiveness ?? 0, rel.contempt ?? 0, rel.stonewalling ?? 0, JSON.stringify(report.horsemen || {})).run();
    for (const sp of report.horsemen?.speakers || []) {
      await env.DB.prepare(`INSERT INTO horsemen_scores (id, analysis_run_id, conversation_id, speaker, criticism, defensiveness, contempt, stonewalling, evidence_json) VALUES (?,?,?,?,?,?,?,?,?)`)
        .bind(uid('horse'), runId, conversation_id, sp.speaker || 'Unknown', sp.criticism ?? 0, sp.defensiveness ?? 0, sp.contempt ?? 0, sp.stonewalling ?? 0, JSON.stringify(sp.evidence || [])).run();
    }
    const rr = report.repair?.relationship || {};
    await env.DB.prepare(`INSERT INTO repair_scores (id, analysis_run_id, conversation_id, speaker, validation, accountability, appreciation, compromise, reconnection, repair_attempts, successful_repairs, evidence_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(uid('repair'), runId, conversation_id, 'Relationship', report.validation_score ?? 0, 0, 0, 0, 0, rr.repair_attempts ?? 0, rr.successful_repairs ?? 0, JSON.stringify(report.repair || {})).run();
    for (const sp of report.repair?.speakers || []) {
      await env.DB.prepare(`INSERT INTO repair_scores (id, analysis_run_id, conversation_id, speaker, validation, accountability, appreciation, compromise, reconnection, repair_attempts, successful_repairs, evidence_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(uid('repair'), runId, conversation_id, sp.speaker || 'Unknown', sp.validation ?? 0, sp.accountability ?? 0, sp.appreciation ?? 0, sp.compromise ?? 0, sp.reconnection ?? 0, sp.repair_attempts ?? 0, sp.successful_repairs ?? 0, JSON.stringify(sp.evidence || [])).run();
    }
    for (const topic of report.topics || []) {
      await env.DB.prepare('INSERT INTO topics (id,conversation_id,name,theme,first_message_position,last_message_position) VALUES (?,?,?,?,?,?)')
        .bind(uid('topic'), conversation_id, topic.name || 'Unknown', topic.theme || null, topic.first_message_position ?? null, topic.last_message_position ?? null).run();
    }
    return json({ ok: true, analysis_run_id: runId, report });
  } catch (err: any) {
    return json({ error: err.message || 'Analysis failed' }, 500);
  }
};
