"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiConversationPlugin = void 0;
const backend_plugin_api_1 = require("@backstage/backend-plugin-api");
const plugin_catalog_node_1 = require("@backstage/plugin-catalog-node");
const router_1 = require("./router");
exports.aiConversationPlugin = (0, backend_plugin_api_1.createBackendPlugin)({
    pluginId: 'ai-conversation',
    register(reg) {
        reg.registerInit({
            deps: {
                httpRouter: backend_plugin_api_1.coreServices.httpRouter,
                config: backend_plugin_api_1.coreServices.rootConfig,
                logger: backend_plugin_api_1.coreServices.logger,
                auth: backend_plugin_api_1.coreServices.auth,
                discovery: backend_plugin_api_1.coreServices.discovery,
                catalog: plugin_catalog_node_1.catalogServiceRef,
                database: backend_plugin_api_1.coreServices.database,
                urlReader: backend_plugin_api_1.coreServices.urlReader,
                scheduler: backend_plugin_api_1.coreServices.scheduler,
            },
            async init({ httpRouter, config, logger, auth, discovery, catalog, database, urlReader, scheduler, }) {
                const router = await (0, router_1.createRouter)({
                    config,
                    logger,
                    auth,
                    discovery,
                    catalog,
                    database,
                    urlReader,
                    scheduler,
                });
                httpRouter.use(router);
            },
        });
    },
});
