/**
 * Block Module Interface — dynamic loading contract for content block types.
 *
 * Each block type (definition, theorem, simulator, etc.) can register a module
 * that provides rendering, validation, and viewer components. Modules are
 * loaded lazily via dynamic import() — only the registry metadata is eagerly
 * available.
 *
 * @module folio-assistant/blocks/types
 */

/** Validation result from a block module's validate function. */
export interface BlockValidationResult {
  valid: boolean;
  errors: Array<{ path: string; message: string }>;
  warnings: Array<{ path: string; message: string }>;
}

/** A rendered output in a specific format. */
export interface RenderOutput {
  format: "html" | "latex" | "markdown" | "svg";
  content: string;
  /** Optional metadata (e.g., required CSS, JS dependencies). */
  meta?: Record<string, unknown>;
}

/** Viewer component that mounts into a DOM element. */
export interface ViewerComponent {
  /** Mount the component into a container element. */
  mount(container: HTMLElement, block: unknown, options?: Record<string, unknown>): void;
  /** Unmount and clean up (remove event listeners, cancel animations, etc.). */
  unmount?(): void;
  /** Update with new block data without full remount. */
  update?(block: unknown): void;
}

/** Simulator runtime for blocks that have interactive simulations. */
export interface SimulatorRuntime {
  /** Initialize the simulator in a canvas/container. */
  init(container: HTMLElement, params: Record<string, unknown>): void;
  /** Update parameters without reinitializing. */
  setParams?(params: Record<string, unknown>): void;
  /** Clean up resources (WebGL contexts, workers, etc.). */
  destroy?(): void;
}

/**
 * Block Module — the contract every block type module implements.
 *
 * Not all methods are required. A minimal module only needs `kind` and
 * one renderer. The registry handles graceful fallback for missing methods.
 */
export interface BlockModule {
  /** Block kind identifier (matches content schema: "definition", "theorem", etc.). */
  readonly kind: string;

  /** Human-readable display name. */
  readonly displayName: string;

  /** Render block to HTML string. */
  renderHtml?(block: unknown): RenderOutput;

  /** Render block to LaTeX string. */
  renderLatex?(block: unknown): RenderOutput;

  /** Validate a block manifest (.ts) against its type constraints. */
  validate?(block: unknown): BlockValidationResult;

  /**
   * Lazy-load a viewer component for this block type.
   * Returns a factory — the actual component code is loaded on demand.
   */
  viewerComponent?(): Promise<ViewerComponent>;

  /**
   * Lazy-load a simulator runtime (for simulator blocks or blocks with
   * simulator refs). Returns null if this block type has no simulator.
   */
  simulatorRuntime?(): Promise<SimulatorRuntime | null>;

  /**
   * Dependencies this block type's viewer needs (loaded once, cached).
   * Example: ["katex", "three.js", "pyodide"]
   */
  viewerDependencies?: string[];

  /**
   * MCP tool names this block type exposes to the assistant.
   * The assistant skill router uses this to know which tools are relevant.
   */
  assistantTools?: string[];
}

/**
 * Block module registration entry.
 * Eagerly stored in the registry; the loader is called lazily.
 */
export interface BlockModuleEntry {
  kind: string;
  displayName: string;
  /** Lazy loader — returns the full module on first access. */
  loader: () => Promise<BlockModule>;
  /** Cached module layer (populated after first load). */
  _cached?: BlockModule;
  /** Dependencies needed by the viewer (for preloading). */
  viewerDependencies?: string[];
}
