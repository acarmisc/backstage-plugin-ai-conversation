import React from 'react';
import { Chat as ChatIcon, BarChart as BarChartIcon } from '@mui/icons-material';
import {
  createFrontendPlugin,
  ApiBlueprint,
  PageBlueprint,
  fetchApiRef,
} from '@backstage/frontend-plugin-api';
import { liteLlmChatApiRef, LiteLlmChatApi } from './api';

const liteLlmChatApi = ApiBlueprint.make({
  params: defineParams =>
    defineParams({
      api: liteLlmChatApiRef,
      deps: { fetchApi: fetchApiRef },
      factory: ({ fetchApi }) => new LiteLlmChatApi(fetchApi),
    }),
});

const chatPage = PageBlueprint.make({
  params: {
    path: '/ai-chat',
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
    path: '/ai-chat/analytics',
    title: 'AI Chat Analytics',
    icon: <BarChartIcon />,
    loader: async () => {
      const { AnalyticsPage } = await import('./components/AnalyticsPage');
      return <AnalyticsPage />;
    },
  },
});

export const litellmChatPlugin = createFrontendPlugin({
  pluginId: 'litellm-chat',
  extensions: [liteLlmChatApi, chatPage, analyticsPage],
});