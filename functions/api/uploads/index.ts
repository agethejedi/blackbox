import { Env, json, uid, nowIso, openaiResponses, extractOutputText } from '../_shared';

async function extractImageText(env: Env, file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  const base64 = btoa(binary);
  const dataUrl = `data:${file.type};base64,${base64}`;
  const ai = await openaiResponses(env, {
    model: 'gpt-5.5',
    input: [{
      role: 'user',
      content: [
        { type: 'input_text', text: 'Extract all visible conversation text from this screenshot. Preserve speaker labels and order where possible. Return plain text only.' },
        { type: 'input_image', image_url: dataUrl }
      ]
    }]
  });
  return extractOutputText(ai);
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const form = await request.formData();
    const file = form.get('file');
    const conversationId = form.get('conversation_id')?.toString() || null;
    if (!(file instanceof File)) return json({ error: 'file required' }, 400);
    const fileId = uid('file');
    const key = `${nowIso().slice(0,10)}/${fileId}-${file.name}`;
    await env.UPLOADS.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
    let extractedText = '';
    if (file.type.startsWith('image/')) extractedText = await extractImageText(env, file);
    await env.DB.prepare('INSERT INTO uploaded_files (id,conversation_id,r2_key,filename,mime_type,size_bytes,extracted_text) VALUES (?,?,?,?,?,?,?)')
      .bind(fileId, conversationId, key, file.name, file.type, file.size, extractedText || null).run();
    return json({ ok: true, file_id: fileId, r2_key: key, extracted_text: extractedText });
  } catch (err: any) {
    return json({ error: err.message || 'Upload failed' }, 500);
  }
};
