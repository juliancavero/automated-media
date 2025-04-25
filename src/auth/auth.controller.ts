import {
    Controller,
    Post,
    Body,
    Get,
    Render,
    Request,
    Response,
    HttpStatus,
    UnauthorizedException,
    Logger
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
    private readonly logger = new Logger(AuthController.name);

    constructor(private readonly authService: AuthService) { }

    @Public()
    @Get('login')
    @Render('auth/login')
    getLoginPage() {
        return {
            title: 'Login',
            error: null
        };
    }

    @Public()
    @Post('login')
    async login(
        @Body() body: { username: string; password: string },
        @Response() res,
    ) {
        try {
            const user = await this.authService.validateUser(
                body.username,
                body.password,
            );

            if (!user) {
                this.logger.warn(`Failed login attempt for username: ${body.username}`);

                // Check if request expects JSON
                const isApiRequest = res.req.headers['accept'] === 'application/json';

                if (isApiRequest) {
                    return res.status(HttpStatus.UNAUTHORIZED).json({
                        statusCode: HttpStatus.UNAUTHORIZED,
                        message: 'Invalid credentials',
                    });
                } else {
                    return res.render('auth/login', {
                        title: 'Login',
                        error: 'Invalid username or password',
                        username: body.username
                    });
                }
            }

            const { access_token } = await this.authService.login(user);

            // For API requests, return JWT
            if (res.req.headers['accept'] === 'application/json') {
                return res.status(HttpStatus.OK).json({
                    access_token,
                    expiresIn: 3600, // 1 hour in seconds
                });
            }

            // For browser requests, set cookie and redirect
            res.cookie('auth_token', access_token, {
                httpOnly: true,
                maxAge: 3600000, // 1 hour in milliseconds
            });

            return res.redirect('/');
        } catch (error) {
            this.logger.error(`Login error: ${error.message}`, error.stack);

            if (res.req.headers['accept'] === 'application/json') {
                return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
                    message: 'An error occurred during authentication',
                });
            } else {
                return res.render('auth/login', {
                    title: 'Login',
                    error: 'An error occurred. Please try again.',
                    username: body.username
                });
            }
        }
    }

    @Post('logout')
    async logout(@Response() res) {
        // Clear the auth cookie
        res.clearCookie('auth_token');

        // Check if request expects JSON
        if (res.req.headers['accept'] === 'application/json') {
            return res.status(HttpStatus.OK).json({
                message: 'Logged out successfully',
            });
        } else {
            return res.redirect('/auth/login');
        }
    }

    @Get('profile')
    getProfile(@Request() req) {
        return req.user;
    }
}
