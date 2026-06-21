import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { User, UserDocument } from '../models/User';
import { generateToken, generateRefreshToken } from '@procurement/middleware';
import { IAuthPayload } from '@procurement/types';
import { logger, config } from '@procurement/common';

export class AuthService {
  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: string;
    department: string;
  }) {
    const existingUsers = await User.query('email').eq(data.email.toLowerCase()).exec();
    if (existingUsers && existingUsers.length > 0) {
      throw new Error('User with this email already exists');
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(data.password, salt);

    const user = new User({
      ...data,
      _id: uuidv4(),
      email: data.email.toLowerCase(),
      password: hashedPassword,
    } as any);
    await user.save();

    const payload: IAuthPayload = {
      userId: user._id as string,
      email: user.email,
      role: user.role as any,
    };

    const sanitizedUser = { ...user.toJSON ? user.toJSON() : user } as any;
    delete sanitizedUser.password;
    delete sanitizedUser.resetPasswordToken;
    delete sanitizedUser.resetPasswordExpires;

    return {
      user: sanitizedUser,
      token: generateToken(payload),
      refreshToken: generateRefreshToken(payload),
    };
  }

  async login(email: string, password: string) {
    const users = await User.query('email').eq(email.toLowerCase()).exec();
    const user = users && users.length > 0 ? users[0] : null;

    if (!user) {
      throw new Error('Invalid credentials');
    }

    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error('Invalid credentials');
    }

    user.lastLogin = new Date();
    await user.save();

    const payload: IAuthPayload = {
      userId: user._id as string,
      email: user.email,
      role: user.role as any,
    };

    logger.info(`User logged in: ${user.email}`);

    const sanitizedUser = { ...(user.toJSON ? user.toJSON() : user) } as any;
    delete sanitizedUser.password;
    delete sanitizedUser.resetPasswordToken;
    delete sanitizedUser.resetPasswordExpires;

    return {
      user: sanitizedUser,
      token: generateToken(payload),
      refreshToken: generateRefreshToken(payload),
    };
  }

  async refreshToken(token: string) {
    const jwt = (await import('jsonwebtoken')).default;

    const decoded = jwt.verify(token, config.jwtRefreshSecret) as IAuthPayload;
    const user = await User.get(decoded.userId);

    if (!user || !user.isActive) {
      throw new Error('Invalid refresh token');
    }

    const payload: IAuthPayload = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };

    return {
      token: generateToken(payload),
      refreshToken: generateRefreshToken(payload),
    };
  }

  async forgotPassword(email: string) {
    const users = await User.query('email').eq(email.toLowerCase()).exec();
    const user = users && users.length > 0 ? users[0] : null;

    if (!user) {
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    user.resetPasswordExpires = new Date(Date.now() + 3600000);
    await user.save();

    logger.info(`Password reset requested for: ${user.email}`);

    return resetToken;
  }

  async resetPassword(token: string, newPassword: string) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const users = await User.scan('resetPasswordToken').eq(hashedToken).exec();
    const user = users.filter((u: any) => u.resetPasswordExpires && new Date(u.resetPasswordExpires) > new Date())[0];

    if (!user) {
      throw new Error('Invalid or expired reset token');
    }

    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    logger.info(`Password reset successful for: ${user.email}`);
  }

  async getProfile(userId: string) {
    const user = await User.get(userId);
    if (!user) throw new Error('User not found');
    const sanitizedUser = { ...(user.toJSON ? user.toJSON() : user) } as any;
    delete sanitizedUser.password;
    delete sanitizedUser.resetPasswordToken;
    delete sanitizedUser.resetPasswordExpires;
    return sanitizedUser;
  }

  async updateProfile(userId: string, data: Partial<UserDocument>) {
    const user = await User.update({ _id: userId }, data);
    if (!user) throw new Error('User not found');
    const sanitizedUser = { ...(user.toJSON ? user.toJSON() : user) } as any;
    delete sanitizedUser.password;
    delete sanitizedUser.resetPasswordToken;
    delete sanitizedUser.resetPasswordExpires;
    return sanitizedUser;
  }

  async changePassword(userId: string, current: string, replacement: string) {
    const user = await User.get(userId);
    if (!user) throw new Error('User not found');

    const isMatch = await bcrypt.compare(current, user.password);
    if (!isMatch) throw new Error('Incorrect current password');

    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(replacement, salt);
    user.mustChangePassword = false;
    await user.save();
  }
}

export default new AuthService();
