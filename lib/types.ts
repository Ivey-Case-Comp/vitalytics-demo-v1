// ─── Persona Types ────────────────────────────────────────────────────────────

export type PersonaKey = "nurse" | "analyst" | "population_health" | "researcher" | "cio";

export interface Persona {
  key: PersonaKey;
  label: string;
  description: string;
  color: string; // Tailwind color class prefix e.g. "blue"
}

export const PERSONAS: Persona[] = [
  {
    key: "nurse",
    label: "Nurse / Clinician",
    description: "Patient safety, care planning, plain-language explanations",
    color: "blue",
  },
  {
    key: "analyst",
    label: "Data Analyst",
    description: "Statistical metrics, fidelity scores, technical precision",
    color: "violet",
  },
  {
    key: "population_health",
    label: "Population Health",
    description: "Cohort segmentation, demographic representativeness",
    color: "green",
  },
  {
    key: "researcher",
    label: "Clinical Researcher",
    description: "Research validity, statistical power, publication readiness",
    color: "amber",
  },
  {
    key: "cio",
    label: "CIO / Executive",
    description: "PHIPA compliance, deployment roadmap, risk framing",
    color: "slate",
  },
];

// ─── SSE Event Types ──────────────────────────────────────────────────────────

export type SSEEventType = "reasoning" | "tool_call" | "tool_result" | "conclusion" | "error" | "done";

export interface SSEEvent {
  type: SSEEventType;
  content?: string;
  name?: string;
  input?: Record<string, unknown>;
  timestamp?: number;
}

// ─── Dataset Metadata ─────────────────────────────────────────────────────────

export interface ColumnStat {
  type: "continuous" | "categorical" | "datetime";
  null_rate: number;
  distribution?: string;
  params?: Record<string, number>;
  p01?: number;
  p99?: number;
  mean?: number;
  std?: number;
  ks_stat?: number;
  top_categories?: [string, number][];
  cardinality?: number;
  suppressed_count?: number;
  rare_threshold?: number;
  min?: string;
  max?: string;
}

export interface DatasetMetadata {
  schema_version: string;
  table: string;
  row_count: number;
  columns: Record<string, ColumnStat>;
  correlations: Record<string, number>;
  suppressed_columns: string[];
  privacy_actions: string[];
}

// ─── Hygiene Types ────────────────────────────────────────────────────────────

export type HygieneSeverity = "CRITICAL" | "WARNING" | "INFO";

export interface HygieneIssue {
  id: string;
  category: string;
  severity: HygieneSeverity;
  description: string;
  affected_count: number;
  fixable: boolean;
  metadata_fix?: Record<string, unknown>;
  applied?: boolean;
}

// ─── Fidelity Types ───────────────────────────────────────────────────────────

export interface DistributionDataPoint {
  bin: string;
  real: number;
  synthetic: number;
}

export interface ColumnFidelityScore {
  column: string;
  wasserstein_score: number;
  distribution_data: DistributionDataPoint[];
}

export interface FidelityReport {
  overall_score: number;
  distribution_fidelity: number;
  correlation_fidelity: number;
  mia_auc: number;
  tstr_ratio: number;
  column_scores: ColumnFidelityScore[];
  correlation_real: number[][];
  correlation_synthetic: number[][];
  correlation_columns: string[];
  rows_real: number;
  rows_synthetic: number;
  model_used?: string;
}

// ─── Pipeline State ───────────────────────────────────────────────────────────

export type PipelineStep = 1 | 2 | 3 | 4 | 5;
export type GenerationStatus = "idle" | "generating" | "done" | "error";

export interface PipelineState {
  sessionId: string | null;
  currentStep: PipelineStep;
  role: PersonaKey;
  metadata: DatasetMetadata | null;
  hygieneIssues: HygieneIssue[] | null;
  appliedFixes: string[]; // ids of applied hygiene fixes
  generationStatus: GenerationStatus;
  generationProgress: string[];
  generationResult: { rows_generated: number; model_used: string } | null;
  fidelityReport: FidelityReport | null;
  demoMode: boolean;
}

export type PipelineAction =
  | { type: "SET_STEP"; step: PipelineStep }
  | { type: "SET_ROLE"; role: PersonaKey }
  | { type: "SET_SESSION_ID"; sessionId: string }
  | { type: "SET_METADATA"; metadata: DatasetMetadata }
  | { type: "SET_HYGIENE_ISSUES"; issues: HygieneIssue[] }
  | { type: "APPLY_FIX"; issueId: string }
  | { type: "SET_GEN_STATUS"; status: GenerationStatus }
  | { type: "ADD_GEN_PROGRESS"; message: string }
  | { type: "SET_GEN_RESULT"; result: { rows_generated: number; model_used: string } }
  | { type: "SET_FIDELITY"; report: FidelityReport }
  | { type: "SET_DEMO_MODE"; demo: boolean }
  | { type: "RESET" };

export const initialPipelineState: PipelineState = {
  sessionId: null,
  currentStep: 1,
  role: "population_health",
  metadata: null,
  hygieneIssues: null,
  appliedFixes: [],
  generationStatus: "idle",
  generationProgress: [],
  generationResult: null,
  fidelityReport: null,
  demoMode: false,
};

export function pipelineReducer(state: PipelineState, action: PipelineAction): PipelineState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, currentStep: action.step };
    case "SET_ROLE":
      return { ...state, role: action.role };
    case "SET_SESSION_ID":
      return { ...state, sessionId: action.sessionId };
    case "SET_METADATA":
      return { ...state, metadata: action.metadata };
    case "SET_HYGIENE_ISSUES":
      return { ...state, hygieneIssues: action.issues };
    case "APPLY_FIX":
      return { ...state, appliedFixes: [...state.appliedFixes, action.issueId] };
    case "SET_GEN_STATUS":
      return { ...state, generationStatus: action.status };
    case "ADD_GEN_PROGRESS":
      return { ...state, generationProgress: [...state.generationProgress, action.message] };
    case "SET_GEN_RESULT":
      return { ...state, generationResult: action.result };
    case "SET_FIDELITY":
      return { ...state, fidelityReport: action.report };
    case "SET_DEMO_MODE":
      return { ...state, demoMode: action.demo };
    case "RESET":
      return { ...initialPipelineState };
    default:
      return state;
  }
}
