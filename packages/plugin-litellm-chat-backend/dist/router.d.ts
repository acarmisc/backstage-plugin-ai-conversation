import { Router } from 'express';
import { Config } from '@backstage/config';
import { AuthService, DatabaseService, DiscoveryService } from '@backstage/backend-plugin-api';
import { CatalogService } from '@backstage/plugin-catalog-node';
export interface RouterOptions {
    config: Config;
    logger: any;
    auth: AuthService;
    discovery: DiscoveryService;
    catalog: CatalogService;
    database: DatabaseService;
}
export declare function createRouter(options: RouterOptions): Promise<Router>;
