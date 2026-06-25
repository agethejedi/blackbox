# JARVIS Tool Spec — Project Black Box

## Tool: blackbox.ingest_conversation
Input: `{ source_type, title, raw_text | file_id }`
Output: `{ conversation_id, normalized_messages, extraction_confidence }`

## Tool: blackbox.analyze_conversation
Input: `{ conversation_id | raw_text, analysis_profile }`
Output: Conversation Quality, Four Horsemen, Repair Index, topic drift, loops, outcome, coaching.

## Tool: blackbox.search_history
Input: `{ query, themes?, topics?, outcome?, date_range? }`
Output: Matching conversations and pattern summary.

## Tool: blackbox.coach_response
Input: `{ draft, context? }`
Output: risk score, likely interpretation, avoid list, rewrite.

## Tool: blackbox.generate_report
Input: `{ conversation_id | search_query, report_type }`
Output: JSON report suitable for UI or PDF export.
