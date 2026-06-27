export type SourceType = 'text_paste' | 'screenshot' | 'email' | 'pdf' | 'audio' | 'note'
export type ConflictOutcome = 'resolved' | 'unresolved' | 'escalated' | 'deferred'
export type AnalysisStatus = 'pending' | 'processing' | 'complete' | 'failed'

export interface Participant {
  id: string; name: string; label: string; color: string;
}
export interface Message {
  id: string; conversation_id: string; speaker_label: string;
  content: string; timestamp?: string; sequence: number;
}
export interface HorsemenScores {
  criticism: number; defensiveness: number; contempt: number; stonewalling: number;
  overall: number; trend: 'rising' | 'falling' | 'stable';
  speaker_breakdown: Record<string, { criticism: number; defensiveness: number; contempt: number; stonewalling: number; }>;
  examples: Array<{ horseman: string; excerpt: string; speaker: string; confidence: number; }>;
}
export interface RepairScores {
  validation_attempts: number; accountability_attempts: number; compromise_attempts: number;
  appreciation_attempts: number; successful_repairs: number; failed_repairs: number;
  recovery_time_minutes: number; resilience_score: number;
}
export interface ConversationAnalysis {
  id: string; conversation_id: string; quality_score: number; escalation_score: number;
  validation_score: number; collaboration_score: number; topic_drift_score: number;
  resolution_probability: number; horsemen: HorsemenScores; repair: RepairScores;
  outcome: ConflictOutcome; topics: string[]; themes: string[];
  coaching_recommendations: string[]; created_at: string; status: AnalysisStatus;
}
export interface Conversation {
  id: string; title: string; source_type: SourceType; uploaded_by: string;
  created_at: string; participants: Participant[]; raw_text?: string;
  messages: Message[]; analysis?: ConversationAnalysis;
  confidence_score: number; attachment_url?: string;
}
export interface CoachReport {
  risk_score: number; risk_level: 'low' | 'medium' | 'high';
  concerns: string[]; tone_analysis: string; validation_gaps: string[];
  defensive_language: string[]; accusations: string[]; topic_drift_risk: number;
  suggested_rewrite: string; what_they_may_hear: string;
  what_to_avoid: string[]; suggested_next_action: string;
}
export interface SearchResult {
  conversation_id: string; title: string; excerpt: string;
  relevance: number; date: string; outcome: ConflictOutcome; topics: string[];
}
export type NavItem = 'dashboard' | 'conversations' | 'collections' | 'quality' | 'horsemen' | 'repair' | 'drift' | 'loops' | 'history' | 'coach' | 'reports' | 'settings'
