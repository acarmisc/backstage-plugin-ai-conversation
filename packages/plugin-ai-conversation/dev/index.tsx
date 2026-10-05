/**
 * Dev harness for the AI Conversation plugin frontend. Renders the chat page
 * with realistic, deterministic mock data from dev/mockFetch.ts and dev/mockApi.ts
 * — no backend required.
 *
 * Usage:
 *   cd packages/plugin-ai-conversation
 *   yarn start
 *   → http://localhost:3000/ai-conversation
 */
import ReactDOM from 'react-dom/client';
import CssBaseline from '@mui/material/CssBaseline';
import ChatIcon from '@mui/icons-material/Chat';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import { createApp } from '@backstage/frontend-defaults';
import {
  createFrontendModule,
  createFrontendPlugin,
  ApiBlueprint,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';
import { liteLlmApiRef } from '@acarmisc/backstage-plugin-litellm';
import { fetchApiRef } from '@backstage/core-plugin-api';
import { aiConversationApiRef } from '../src/api';
import { AiConversationApi } from '../src/api';
import { MockLiteLlmApi } from './mockApi';
import { MockFetchApi } from './mockFetch';

// Override the real LiteLLM API with the mock one.
const mockLiteLlmApi = ApiBlueprint.make({
  name: 'litellm',
  params: defineParams =>
    defineParams({
      api: liteLlmApiRef,
      deps: {},
      factory: () => new MockLiteLlmApi(),
    }),
});

// Replace the app's fetchApi (extension api:app/fetch) with the mock, so both
// AiConversationApi and the AI SDK streaming transport in useThreads (which
// uses fetchApiRef directly) hit dev/mockFetch.ts.
const mockFetchModule = createFrontendModule({
  pluginId: 'app',
  extensions: [
    ApiBlueprint.make({
      name: 'fetch',
      params: defineParams =>
        defineParams({
          api: fetchApiRef,
          deps: {},
          factory: () => new MockFetchApi(),
        }),
    }),
  ],
});

// The real AiConversationApi, on top of the mocked fetchApi.
const aiConversationApi = ApiBlueprint.make({
  params: defineParams =>
    defineParams({
      api: aiConversationApiRef,
      deps: { fetchApi: fetchApiRef },
      factory: ({ fetchApi }) => new AiConversationApi(fetchApi),
    }),
});

// Register the ChatPage at /ai-conversation.
const chatPage = PageBlueprint.make({
  params: {
    path: '/ai-conversation',
    title: 'AI Chat',
    icon: <ChatIcon />,
    loader: async () => {
      const { ChatPage } = await import('../src/components/ChatPage');
      return <ChatPage />;
    },
  },
});

// Register the AnalyticsPage at /ai-conversation/analytics.
const analyticsPage = PageBlueprint.make({
  name: 'analytics',
  params: {
    path: '/ai-conversation/analytics',
    title: 'Analytics',
    icon: <AnalyticsIcon />,
    loader: async () => {
      const { AnalyticsPage } = await import('../src/components/AnalyticsPage');
      return <AnalyticsPage />;
    },
  },
});

// Create the dev plugin with all the overrides and pages.
const devAiConversationPlugin = createFrontendPlugin({
  pluginId: 'ai-conversation',
  extensions: [mockLiteLlmApi, aiConversationApi, chatPage, analyticsPage],
});

// Create the app and render.
const app = createApp({
  features: [mockFetchModule, devAiConversationPlugin],
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <>
    <CssBaseline />
    {app.createRoot()}
  </>,
);
