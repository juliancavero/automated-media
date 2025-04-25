import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromExtractors([
                // Try to extract from cookies first (for browser-based requests)
                (req) => {
                    let token = null;
                    if (req && req.cookies) {
                        token = req.cookies['auth_token'];
                    }
                    return token;
                },
                // Fall back to Authorization header (for API requests)
                ExtractJwt.fromAuthHeaderAsBearerToken(),
            ]),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_SECRET || 'your-secret-key',
        });
    }

    async validate(payload: JwtPayload): Promise<any> {
        const user = await this.userModel.findOne({ username: payload.username }).exec();

        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        return { userId: payload.sub, username: payload.username };
    }
}
