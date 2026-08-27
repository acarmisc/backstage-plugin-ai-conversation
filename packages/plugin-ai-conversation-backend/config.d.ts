export interface Config {
  litellm: {
    /**
     * Base URL of the LiteLLM proxy instance.
     * @visibility backend
     */
    baseUrl: string;

    /**
     * LiteLLM master key for admin operations. Never exposed to the frontend.
     * @visibility secret
     */
    masterKey: string;

    /**
     * Email domain appended to the Backstage user entity name to form the
     * LiteLLM user_id. Inherited from the govai plugin config.
     * @visibility backend
     */
    userIdDomain?: string;

    /**
     * Optional chat-specific defaults. Pre-selected in the UI when present.
     * All fields optional — the user can override in the pickers.
     * @visibility frontend
     */
    aiConversation?: {
      /**
       * Model ID pre-selected in the model picker on first load.
       */
      defaultModel?: string;

      /**
       * Vector store IDs pre-selected in the KB picker on first load.
       */
      defaultVectorStoreIds?: string[];

      /**
       * Soft USD guard surfaced to the UI. Real enforcement is per-key
       * in LiteLLM; this is advisory only.
       */
      maxRequestBudget?: number;

      /**
       * Server-side chat history (thread) persistence. Off by default —
       * threads stay client-side-only (React state + localStorage) unless
       * explicitly opted in here.
       * @visibility frontend
       */
      persistence?: {
        /**
         * Persist chat threads server-side in the plugin's own database
         * instead of (in addition to) the browser's localStorage. Defaults
         * to false.
         */
        enabled?: boolean;

        /**
         * Days a persisted thread is kept before automatic deletion by the
         * background cleanup task. 0 means unlimited — threads are never
         * auto-deleted. Defaults to 30. Ignored when `enabled` is false.
         */
        ttlDays?: number;
      };

      /**
       * Model ids known to accept image attachments (Phase 18). Overrides
       * the built-in naming-pattern heuristic — LiteLLM's own model
       * registry carries no vision/multimodal capability metadata, so
       * there's no authoritative source to check against automatically.
       * Set this once real registered models are known.
       * @visibility backend
       */
      multimodalModels?: string[];
    };
  };
}