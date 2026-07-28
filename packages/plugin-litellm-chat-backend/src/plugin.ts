import { coreServices, createBackendPlugin } from '@backstage/backend-plugin-api';
import { catalogServiceRef } from '@backstage/plugin-catalog-node';
import { createRouter } from './router';

export const litellmChatPlugin = createBackendPlugin({
  pluginId: 'litellm-chat',
  register(reg) {
    reg.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        auth: coreServices.auth,
        discovery: coreServices.discovery,
        catalog: catalogServiceRef,
      },
      async init({ httpRouter, config, logger, auth, discovery, catalog }) {
        const router = await createRouter({ config, logger, auth, discovery, catalog });
        httpRouter.use(router);
      },
    });
  },
});