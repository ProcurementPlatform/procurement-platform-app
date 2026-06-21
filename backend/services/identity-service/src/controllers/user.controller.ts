import { Response } from 'express';
import { IAuthenticatedRequest } from '@procurement/types';
import { User } from '../models/User';
import { sendSuccess, sendError } from '@procurement/utils';

export class UserController {
  async findAll(_req: IAuthenticatedRequest, res: Response) {
    try {
      const allUsers = await User.scan().exec();
      const users = allUsers.map((u: any) => {
        const copy = { ...(u.toJSON ? u.toJSON() : u) };
        delete copy.password;
        return copy;
      });
      return sendSuccess(res, users);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async findById(req: IAuthenticatedRequest, res: Response) {
    try {
      const user = await User.get(req.params.id);
      if (!user) return sendError(res, 'User not found', 404);
      const copy = { ...(user.toJSON ? user.toJSON() : user) } as any;
      delete copy.password;
      return sendSuccess(res, copy);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async update(req: IAuthenticatedRequest, res: Response) {
    try {
      const user: any = await User.update({ _id: req.params.id }, req.body);
      if (!user) return sendError(res, 'User not found', 404);
      const copy = { ...(user.toJSON && typeof user.toJSON === 'function' ? user.toJSON() : user) } as any;
      delete copy.password;
      return sendSuccess(res, copy, 'User updated');
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async delete(req: IAuthenticatedRequest, res: Response) {
    try {
      await User.delete(req.params.id);
      return sendSuccess(res, null, 'User deleted');
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }
}

export default new UserController();
