"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRouter = createRouter;
const express_1 = __importStar(require("express"));
const backend_plugin_api_1 = require("@backstage/backend-plugin-api");
const integration_1 = require("@backstage/integration");
const backstage_plugin_litellm_backend_1 = require("@acarmisc/backstage-plugin-litellm-backend");
const stream_1 = require("./stream");
const persona_1 = require("./persona");
const urlContext_1 = require("./urlContext");
const types_1 = require("./types");
/** How long a composed persona prompt is cached before it's re-fetched and
 * re-expanded from source. Keeps message sends off the SCM hot path while
 * still picking up prompt edits within a few minutes. */
const PERSONA_PROMPT_TTL_MS = 5 * 60 * 1000;
function readChatConfig(config) {
    return {
        baseUrl: config.getString('litellm.baseUrl'),
        defaultModel: config.getOptionalString('litellm.chat.defaultModel'),
        defaultVectorStoreIds: config.getOptionalStringArray('litellm.chat.defaultVectorStoreIds'),
        maxRequestBudget: config.getOptionalNumber('litellm.chat.maxRequestBudget'),
        fetchContextMaxChars: config.getOptionalNumber('litellm.chat.fetchContext.maxChars'),
    };
}
async function createRouter(options) {
    const { config, logger, auth, catalog, database, urlReader } = options;
    const chatConfig = readChatConfig(config);
    const scm = integration_1.ScmIntegrations.fromConfig(config);
    const promptDeps = { reader: urlReader, scm };
    const promptCache = new Map();
    const userIdDomain = config.getOptionalString('litellm.userIdDomain');
    const masterKey = config.getString('litellm.masterKey');
    const dbClient = await database.getClient();
    if (!database.migrations?.skip) {
        await dbClient.migrate.latest({
            directory: (0, backend_plugin_api_1.resolvePackagePath)('@acarmisc/backstage-plugin-litellm-chat-backend', 'migrations'),
        });
    }
    // Resolves and caches a persona's system prompt by entity ref. Resolved
    // server-side so the prompt text never has to round-trip through the
    // browser (see PersonaSummary in types.ts). Throws with a `status` field
    // on invalid/missing personas so callers can respond with the right HTTP
    // status.
    async function resolvePersonaPrompt(personaId) {
        const cached = promptCache.get(personaId);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.prompt;
        }
        const credentials = await auth.getOwnServiceCredentials();
        const entity = await catalog.getEntityByRef(personaId, { credentials });
        if (!entity || entity.spec?.type !== types_1.CHAT_PERSONA_TYPE) {
            throw Object.assign(new Error('invalid persona_id'), { status: 400 });
        }
        const systemPrompt = await (0, persona_1.resolveSystemPrompt)(entity, promptDeps);
        if (!systemPrompt) {
            throw Object.assign(new Error('persona has no system prompt'), { status: 400 });
        }
        promptCache.set(personaId, {
            prompt: systemPrompt,
            expiresAt: Date.now() + PERSONA_PROMPT_TTL_MS,
        });
        return systemPrompt;
    }
    // Prepends a system message to `messages` combining the persona's system
    // prompt (if `personaId` is set) with the user's free-text
    // `customSystemPrompt` (if set) — persona first, then the custom prompt
    // appended below it. If only one of the two is present, that one is used
    // as-is; if neither is present, `messages` is returned unchanged.
    async function applyPersona(personaId, customSystemPrompt, messages) {
        const personaPrompt = personaId ? await resolvePersonaPrompt(personaId) : undefined;
        const trimmedCustom = customSystemPrompt?.trim() || undefined;
        const systemPrompt = [personaPrompt, trimmedCustom].filter(Boolean).join('\n\n');
        if (!systemPrompt)
            return messages;
        return [{ id: 'persona-system', role: 'system', content: systemPrompt }, ...messages];
    }
    // Ad-hoc #url context: SSRF-guarded fetch + extraction lives in
    // urlContext.ts. Cached briefly by URL so the preview chip fetch (on
    // typing) and the actual chat-turn fetch (on send) don't hit the target
    // site twice for the same message.
    const URL_CONTEXT_TTL_MS = 10 * 60 * 1000;
    const urlContextCache = new Map();
    async function resolveUrlContext(url) {
        const cached = urlContextCache.get(url);
        if (cached && cached.expiresAt > Date.now())
            return cached.result;
        const result = await (0, urlContext_1.fetchUrlContext)(url, chatConfig.fetchContextMaxChars);
        urlContextCache.set(url, { result, expiresAt: Date.now() + URL_CONTEXT_TTL_MS });
        return result;
    }
    // Prepends the fetched page as a one-off system message, after the
    // persona/custom system prompt. Best-effort: a fetch failure here logs
    // and degrades to no context rather than failing the whole chat turn —
    // the user already saw the error in the composer's preview chip before
    // sending.
    async function applyUrlContext(contextUrl, messages) {
        if (!contextUrl)
            return messages;
        let fetched;
        try {
            fetched = await resolveUrlContext(contextUrl);
        }
        catch (err) {
            logger.warn(`Failed to fetch #url context for ${contextUrl}: ${err.message}`);
            return messages;
        }
        const content = [
            'The user attached the following web page as one-off context for this message.',
            `URL: ${fetched.url}`,
            `Title: ${fetched.title}`,
            '',
            fetched.text,
        ].join('\n');
        return [{ id: 'url-context', role: 'system', content }, ...messages];
    }
    // LiteLLM-native endpoint (not OpenAI passthrough /v1/vector_stores).
    async function fetchVectorStores() {
        const upstream = await fetch(`${chatConfig.baseUrl}/v1/vector_store/list`, {
            headers: { Authorization: `Bearer ${masterKey}` },
        });
        if (!upstream.ok) {
            const text = await upstream.text().catch(() => '');
            throw new Error(text || upstream.statusText);
        }
        const data = await upstream.json();
        // LiteLLM returns { data: [{ vector_store_id, vector_store_name, ... }] }
        const raw = Array.isArray(data) ? data : (data.data ?? []);
        return raw.map(s => ({
            id: s.vector_store_id ?? s.id,
            name: s.vector_store_name ?? s.name,
            status: s.custom_llm_provider ?? s.status,
        }));
    }
    const router = (0, express_1.Router)();
    // JSON parser for request bodies. The request bodies are small JSON
    // (messages + model + key). The SSE *response* stream is not affected
    // by the request body parser. Backstage's HttpRouterService does not
    // add compression by default, so the response stream is not buffered.
    router.use(express_1.default.json());
    router.get('/health', (_req, res) => {
        res.json({ status: 'ok' });
    });
    router.get('/config', (_req, res) => {
        res.json({
            defaultModel: chatConfig.defaultModel ?? null,
            defaultVectorStoreIds: chatConfig.defaultVectorStoreIds ?? null,
            maxRequestBudget: chatConfig.maxRequestBudget ?? null,
        });
    });
    router.get('/personas', async (_req, res) => {
        try {
            const credentials = await auth.getOwnServiceCredentials();
            const [result, stores] = await Promise.all([
                catalog.getEntities({ filter: { kind: 'Component', 'spec.type': types_1.CHAT_PERSONA_TYPE } }, { credentials }),
                // Persona authors write human-friendly store names (e.g. "oo-kb")
                // in the catalog annotation — resolve them to the real
                // vector_store_id the picker/request payload expects. Best-effort:
                // if LiteLLM is unreachable, personas still list, just without
                // resolved KB defaults.
                fetchVectorStores().catch(() => []),
            ]);
            const byNameOrId = new Map(stores.flatMap(s => [[s.id, s.id], [s.name, s.id]]));
            const personas = result.items.map(persona_1.entityToPersonaSummary).map(p => ({
                ...p,
                defaultVectorStoreIds: p.defaultVectorStoreIds
                    ?.map(v => byNameOrId.get(v))
                    .filter((v) => !!v),
            }));
            res.json(personas);
        }
        catch (err) {
            logger.error('Failed to list personas', err);
            res.status(502).json({ error: err.message });
        }
    });
    router.get('/vector_stores', async (_req, res) => {
        try {
            res.json(await fetchVectorStores());
        }
        catch (err) {
            logger.error('Failed to list vector stores', err);
            res.status(502).json({ error: err.message });
        }
    });
    // Preview for the composer's `#url` chip: fetches (SSRF-guarded) and
    // returns title + a short snippet only, never the full extracted text —
    // the full text is re-resolved (cache-hit, same guarded fetch) server-side
    // when the chat turn is actually sent, same pattern as personas never
    // sending their system prompt to the browser.
    router.post('/fetch-context', async (req, res) => {
        try {
            const tokenEntityRef = await (0, backstage_plugin_litellm_backend_1.resolveUserId)(req, auth);
            if (!tokenEntityRef) {
                res.status(401).json({ error: 'unauthenticated' });
                return;
            }
            const body = req.body;
            if (!body?.url || typeof body.url !== 'string' || body.url.length > 2000) {
                res.status(400).json({ error: 'url required' });
                return;
            }
            const result = await resolveUrlContext(body.url);
            res.json({
                url: result.url,
                title: result.title,
                snippet: result.text.slice(0, 240),
                charCount: result.text.length,
            });
        }
        catch (err) {
            logger.warn('fetch-context failed', err);
            res.status(err.status ?? 502).json({ error: err.message });
        }
    });
    // Mint a dedicated chat key for the authenticated user. The real sk- key
    // is returned ONCE and stored client-side in the thread. LiteLLM only
    // stores hashed keys — listKeys cannot recover it.
    router.post('/chat/key', async (req, res) => {
        try {
            const tokenEntityRef = await (0, backstage_plugin_litellm_backend_1.resolveUserId)(req, auth);
            if (!tokenEntityRef) {
                res.status(401).json({ error: 'unauthenticated' });
                return;
            }
            const userId = (0, backstage_plugin_litellm_backend_1.toLiteLLMUserId)(tokenEntityRef, userIdDomain);
            const client = new backstage_plugin_litellm_backend_1.LiteLLMClient({ baseUrl: chatConfig.baseUrl, masterKey });
            const body = (req.body ?? {});
            const alias = `chat-${userId}-${Date.now()}`;
            const result = await client.generateKey({
                alias,
                models: body.models ?? [],
                max_budget: body.max_budget,
                user_id: userId,
                duration: '24h',
                metadata: {
                    created_via: 'backstage-chat',
                    created_by_backstage_user: tokenEntityRef,
                },
            });
            res.json({
                key: result.key,
                key_alias: alias,
                expires_at: result.expires_at,
                max_budget: result.max_budget,
            });
        }
        catch (err) {
            logger.error('Failed to mint chat key', err);
            res.status(502).json({ error: err.message });
        }
    });
    // Delete a chat key by its real sk- value (client sends what it stored).
    router.delete('/chat/key', async (req, res) => {
        try {
            const tokenEntityRef = await (0, backstage_plugin_litellm_backend_1.resolveUserId)(req, auth);
            if (!tokenEntityRef) {
                res.status(401).json({ error: 'unauthenticated' });
                return;
            }
            const { key } = req.body;
            if (!key) {
                res.status(400).json({ error: 'key required' });
                return;
            }
            const client = new backstage_plugin_litellm_backend_1.LiteLLMClient({ baseUrl: chatConfig.baseUrl, masterKey });
            await client.deleteKeys({ keys: [key] });
            res.json({ success: true });
        }
        catch (err) {
            logger.error('Failed to delete chat key', err);
            res.status(502).json({ error: err.message });
        }
    });
    // Current spend/budget for a chat key, looked up by its alias (the token
    // itself is never sent back to the server after mint — only the alias,
    // which the client already has from the mint response).
    router.get('/chat/key/:alias/spend', async (req, res) => {
        try {
            const tokenEntityRef = await (0, backstage_plugin_litellm_backend_1.resolveUserId)(req, auth);
            if (!tokenEntityRef) {
                res.status(401).json({ error: 'unauthenticated' });
                return;
            }
            const userId = (0, backstage_plugin_litellm_backend_1.toLiteLLMUserId)(tokenEntityRef, userIdDomain);
            const client = new backstage_plugin_litellm_backend_1.LiteLLMClient({ baseUrl: chatConfig.baseUrl, masterKey });
            const keys = await client.listKeys(userId);
            const match = keys.find(k => k.key_alias === req.params.alias);
            if (!match) {
                res.status(404).json({ error: 'key not found' });
                return;
            }
            res.json({ spend: match.spend, max_budget: match.max_budget ?? null });
        }
        catch (err) {
            logger.error('Failed to fetch chat key spend', err);
            res.status(502).json({ error: err.message });
        }
    });
    // Records a thumbs-up/down vote on an assistant message. Threads/messages
    // are never persisted server-side (see AGENTS.md), so the request carries
    // a snapshot of the Q&A and context — this is the only durable trace of a
    // chat exchange this plugin keeps. Upserts on (thread_id, message_id,
    // user_ref) so re-voting updates in place instead of accumulating rows.
    router.post('/feedback', async (req, res) => {
        try {
            const tokenEntityRef = await (0, backstage_plugin_litellm_backend_1.resolveUserId)(req, auth);
            if (!tokenEntityRef) {
                res.status(401).json({ error: 'unauthenticated' });
                return;
            }
            const body = req.body;
            if (!body?.threadId ||
                !body?.messageId ||
                (body.vote !== 'up' && body.vote !== 'down')) {
                res.status(400).json({
                    error: 'threadId, messageId, vote (up|down) required',
                });
                return;
            }
            await dbClient('chat_message_feedback')
                .insert({
                thread_id: body.threadId,
                message_id: body.messageId,
                user_ref: tokenEntityRef,
                vote: body.vote,
                comment: body.comment ?? null,
                question: body.question ?? '',
                answer: body.answer ?? '',
                model: body.model ?? '',
                persona_id: body.personaId ?? null,
                vector_store_ids: body.vectorStoreIds
                    ? JSON.stringify(body.vectorStoreIds)
                    : null,
            })
                .onConflict(['thread_id', 'message_id', 'user_ref'])
                .merge({ vote: body.vote, comment: body.comment ?? null });
            res.json({ success: true });
        }
        catch (err) {
            logger.error('Failed to record chat feedback', err);
            res.status(500).json({ error: err.message });
        }
    });
    router.post('/chat/completions', async (req, res) => {
        try {
            const body = req.body;
            if (!body?.model || !body?.messages || !body?.user_key) {
                res.status(400).json({
                    error: 'model, messages, user_key required',
                });
                return;
            }
            const tokenEntityRef = await (0, backstage_plugin_litellm_backend_1.resolveUserId)(req, auth);
            if (!tokenEntityRef) {
                res.status(401).json({ error: 'unauthenticated' });
                return;
            }
            // Resolve to confirm identity — LiteLLM auth uses the user_key, but
            // resolving the user_id validates the Backstage token.
            (0, backstage_plugin_litellm_backend_1.toLiteLLMUserId)(tokenEntityRef, userIdDomain);
            let messages = await applyPersona(body.persona_id, body.custom_system_prompt, body.messages);
            messages = await applyUrlContext(body.context_url, messages);
            const payload = {
                model: body.model,
                messages,
                stream: false,
            };
            if (body.vector_store_ids?.length) {
                payload.vector_store_ids = body.vector_store_ids;
                payload.top_k = body.top_k ?? 5;
            }
            if (body.web_search) {
                payload.web_search_options = {};
            }
            const upstream = await fetch(`${chatConfig.baseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${body.user_key}`,
                },
                body: JSON.stringify(payload),
            });
            const data = await upstream.json();
            if (!upstream.ok) {
                res.status(upstream.status).json(data);
                return;
            }
            res.json(data);
        }
        catch (err) {
            logger.error('chat/completions failed', err);
            res.status(err.status ?? 500).json({ error: err.message });
        }
    });
    router.post('/chat/stream', async (req, res) => {
        try {
            const body = req.body;
            if (!body?.model || !body?.messages || !body?.user_key) {
                res.status(400).json({
                    error: 'model, messages, user_key required',
                });
                return;
            }
            const tokenEntityRef = await (0, backstage_plugin_litellm_backend_1.resolveUserId)(req, auth);
            if (!tokenEntityRef) {
                res.status(401).json({ error: 'unauthenticated' });
                return;
            }
            (0, backstage_plugin_litellm_backend_1.toLiteLLMUserId)(tokenEntityRef, userIdDomain);
            let messages = await applyPersona(body.persona_id, body.custom_system_prompt, body.messages);
            messages = await applyUrlContext(body.context_url, messages);
            const base = chatConfig.baseUrl;
            // /v1/chat/completions (+ vector_store_ids for RAG) — works on
            // LiteLLM v1.90.0 with DB-backed pgvector stores. No fallback: the
            // primary path retrieves and cites KB results, and a fallback here
            // only masks the real primary error from the client.
            const chatBody = {
                model: body.model,
                messages,
                stream: true,
                stream_options: { include_usage: true },
            };
            if (body.vector_store_ids?.length) {
                chatBody.vector_store_ids = body.vector_store_ids;
            }
            if (body.web_search) {
                chatBody.web_search_options = {};
            }
            await (0, stream_1.proxySSE)({
                upstreamUrl: `${base}/v1/chat/completions`,
                upstreamBody: chatBody,
                userKey: body.user_key,
                res,
                logger,
            });
        }
        catch (err) {
            logger.error('chat/stream failed', err);
            if (!res.headersSent) {
                res.status(err.status ?? 500).json({ error: err.message });
            }
        }
    });
    return router;
}
