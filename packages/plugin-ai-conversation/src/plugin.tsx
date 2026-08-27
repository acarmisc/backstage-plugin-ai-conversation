import React from 'react';
import { Chat as ChatIcon, BarChart as BarChartIcon } from '@mui/icons-material';
import {
  createFrontendPlugin,
  ApiBlueprint,
  PageBlueprint,
  fetchApiRef,
} from '@backstage/frontend-plugin-api';
import { aiConversationApiRef, AiConversationApi } from './api';

const liteLlmChatApi = ApiBlueprint.make({
  params: defineParams =>
    defineParams({
      api: aiConversationApiRef,
      deps: { fetchApi: fetchApiRef },
      factory: ({ fetchApi }) => new AiConversationApi(fetchApi),
    }),
});

const chatPage = PageBlueprint.make({
  params: {
    path: '/ai-conversation',
    title: 'AI Chat',
    icon: <ChatIcon />,
    loader: async () => {
      const { ChatPage } = await import('./components/ChatPage');
      return <ChatPage />;
    },
  },
});

const analyticsPage = PageBlueprint.make({
  name: 'analytics',
  params: {
    path: '/ai-conversation/analytics',
    title: 'AI Chat Analytics',
    icon: <BarChartIcon />,
    loader: async () => {
      const { AnalyticsPage } = await import('./components/AnalyticsPage');
      return <AnalyticsPage />;
    },
  },
});

export const aiConversationPlugin = createFrontendPlugin({
  pluginId: 'ai-conversation',
  extensions: [liteLlmChatApi, chatPage, analyticsPage],
});