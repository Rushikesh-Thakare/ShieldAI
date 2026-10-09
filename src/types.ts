export type Risk = 'safe' | 'suspicious' | 'danger'

export interface ScanFlag {
  text_snippet: string
  type: string
  color: string
  explanation: string
}

export interface InlineHighlight {
  text: string
  category: string
  reason: string
}

export interface UrlReport {
  original?: string
  scanned_url?: string
  final?: string
  final_url?: string
  hops?: number
  virustotal?: {
    status?: string
    malicious?: number
    malicious_votes?: number
    total_engines?: number
  }
  safe_browsing?: {
    matched?: boolean
    matches?: Array<{ threatType: string }>
  }
  chain?: Array<{ url: string; status: number }>
}

export interface ScanResult {
  id: string
  created_at: string
  input_type?: string
  risk_score: number
  risk_level: Risk
  verdict: string
  threat_type?: string
  summary: string
  impersonated_brand?: string | null
  red_flags?: string[]
  flags: ScanFlag[]
  inline_highlights?: InlineHighlight[]
  domains?: string[]
  urls_inspected?: UrlReport[]
  virustotal_data?: {
    status?: string
    malicious?: number
    malicious_votes?: number
    total_engines?: number
  }
  safe_browsing?: {
    status?: string
    matched?: boolean
  }
  analysis_source?: string
  dataset_classification?: {
    type: 'text' | 'url'
    label: 'safe' | 'malicious'
    malicious_probability: number
    threshold: number
    confidence: number
  } | null
  storage_status?: string
  recommended_action?: {
    type: string
    abuse_email?: string
    draft_report?: string
  }
}

export interface ThreatLakeItem {
  id?: string
  domain: string
  highest_risk_score?: number
  risk_score?: number
  incident_count?: number
  incidents?: number
  threat_type?: string
  category?: string
  last_detected_at?: string
  created_at?: string
}

export interface ChatMessage {
  id: string
  from: 'user' | 'shield'
  text: string
  timestamp?: string
  provider?: string
  warning?: string
  source?: string
}

export interface EngineInfo {
  name: string
  status: 'operational' | 'degraded' | 'offline'
  latency: string
  detail: string
}
