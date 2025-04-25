import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        private jwtService: JwtService,
    ) { }

    async validateUser(username: string, pass: string): Promise<any> {
        const user = await this.userModel.findOne({ username }).exec();

        if (!user) {
            this.logger.warn(`User not found: ${username}`);
            return null;
        }

        const isMatch = await bcrypt.compare(pass, user.password);

        if (isMatch) {
            const { password, ...result } = user.toObject();
            return result;
        }

        return null;
    }

    async login(user: any) {
        const payload: JwtPayload = {
            username: user.username,
            sub: user._id.toString(),
        };

        return {
            access_token: this.jwtService.sign(payload),
        };
    }

    async createUser(username: string, password: string): Promise<User> {
        try {
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            const newUser = new this.userModel({
                username,
                password: hashedPassword,
            });

            return await newUser.save();
        } catch (error) {
            this.logger.error(`Error creating user: ${error.message}`, error.stack);
            throw error;
        }
    }

    async findByUsername(username: string): Promise<User | null> {
        return this.userModel.findOne({ username }).exec();
    }
}
