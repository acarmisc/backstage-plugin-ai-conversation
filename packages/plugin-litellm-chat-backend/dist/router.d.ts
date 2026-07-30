import { Router } from 'express';
import { Config } from '@backstage/config';
import { AuthService, DatabaseService, DiscoveryService, UrlReaderService } from '@backstage/backend-plugin-api';
import { CatalogService } from '@backstage/plugin-catalog-node';
export interface RouterOptions {
    config: Config;
    logger: any;
    auth: AuthService;
    discovery: DiscoveryService;
    catalog: CatalogService;
    database: DatabaseService;
    urlReader: UrlReaderService;
}
export declare function createRouter(options: RouterOptions): Promise<Router>;
