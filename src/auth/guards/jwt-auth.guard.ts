import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    constructor(private reflector: Reflector) {
        super();
    }

    canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
        // Check if endpoint is public
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (isPublic) {
            return true;
        }

        // Check JWT authentication for protected routes
        return super.canActivate(context);
    }

    handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
        // If no user and not a public route, throw an error
        if (err || !user) {
            // Get the request from context
            const request = context.switchToHttp().getRequest();

            // If it's an API request, throw standard unauthorized exception
            if (request.url.startsWith('/api/') || request.headers['accept'] === 'application/json') {
                throw err || new UnauthorizedException('Authentication required');
            }

            // For browser requests, redirect to login page
            const response = context.switchToHttp().getResponse();
            response.redirect('/auth/login');
            return null;
        }

        return user;
    }
}
