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
       * USD budget of each chat key minted for a conversation. The backend
       * caps whatever the client requests at this value, and LiteLLM
       * enforces it on the key (on top of the team's own budget).
       */
      maxRequestBudget?: number;

      /**
       * Whether a team must be selected before a chat key can be minted.
       * Mirrors govai's `litellm.keyGeneration.teamRequired` (also default
       * true), but read from this plugin's own config so the chat surface
       * is independent of the installed govai version. When true, the chat
       * key is minted with the selected team's id and inherits its budget,
       * rate limits and model allowlist. Set to false to allow personal,
       * team-less chat keys.
       * @visibility backend
       * @default true
       */
      teamRequired?: boolean;

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
       * Where chat skills (system-prompt presets) are discovered. When
       * omitted, both the skills bundled with the plugin and any
       * `chat-skill` catalog entities are used.
       * @visibility backend
       */
      skills?: {
        /**
         * Ordered list of skill sources. Each entry currently supports
         * `type: 'bundled'` (SKILL.md dirs shipped with the plugin) or
         * `type: 'catalog'` (`chat-skill` Component entities). Order is
         * the precedence for id collisions and prompt resolution.
         */
        sources?: Array<{ type: string }>;

        /**
         * Override the directory the `bundled` source reads SKILL.md
         * folders from. Defaults to the `skills/` dir inside this package.
         */
        bundledPath?: string;
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

      /**
       * Model ids hidden from the model picker. Case-insensitive exact
       * match against the LiteLLM model name; entries ending in `*` are
       * treated as prefixes. Use this to hide models that are registered in
       * LiteLLM but can't actually be called through Backstage (e.g. ones
       * needing a credential only the vendor CLI injects).
       * @visibility backend
       */
      excludedModels?: string[];
    };
  };
}