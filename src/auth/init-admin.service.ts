import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class InitAdminService implements OnModuleInit {
    private readonly logger = new Logger(InitAdminService.name);

    constructor(private readonly authService: AuthService) { }

    async onModuleInit() {
        try {
            // Check if default admin exists
            const defaultAdminUsername = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
            const defaultAdminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin';

            const existingAdmin = await this.authService.findByUsername(defaultAdminUsername);

            if (!existingAdmin) {
                // Create default admin if not exists
                await this.authService.createUser(defaultAdminUsername, defaultAdminPassword);
                this.logger.log(`Default admin user '${defaultAdminUsername}' created`);
            } else {
                this.logger.log(`Default admin user '${defaultAdminUsername}' already exists`);
            }
        } catch (error) {
            this.logger.error('Failed to initialize admin user:', error.message);
        }
    }
}
