import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi } from '../../services/endpoints';
import { formatDate, getInitials } from '../../lib/utils';
import { Users, Plus, Trash2, Shield } from 'lucide-react';

const UserManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['users'], queryFn: () => userApi.getAll() });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => userApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const users = Array.isArray(data) ? data : [];

  const roleColors: Record<string, string> = {
    admin: 'bg-white/10 text-white',
    procurement_manager: 'bg-blue-400/10 text-blue-400',
    finance: 'bg-emerald-400/10 text-emerald-400',
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div><h1 className="page-title">User Management</h1><p className="page-description">Manage system users and permissions</p></div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-xs font-medium text-neutral-500 px-6 py-3">User</th>
                <th className="text-left text-xs font-medium text-neutral-500 px-6 py-3">Role</th>
                <th className="text-left text-xs font-medium text-neutral-500 px-6 py-3">Department</th>
                <th className="text-left text-xs font-medium text-neutral-500 px-6 py-3">Status</th>
                <th className="text-left text-xs font-medium text-neutral-500 px-6 py-3">Last Login</th>
                <th className="text-left text-xs font-medium text-neutral-500 px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? [...Array(5)].map((_, i) => <tr key={i} className="table-row"><td colSpan={6} className="px-6 py-4"><div className="loading-skeleton h-4 w-full" /></td></tr>)
              : users.map((user: any) => (
                <tr key={user._id} className="table-row">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-medium text-white">
                        {getInitials(user.firstName, user.lastName)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{user.firstName} {user.lastName}</p>
                        <p className="text-xs text-neutral-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4"><span className={`badge ${roleColors[user.role] || 'badge-draft'}`}>{user.role.replace('_', ' ')}</span></td>
                  <td className="px-6 py-4 text-sm text-neutral-400">{user.department}</td>
                  <td className="px-6 py-4">
                    <span className={`badge ${user.isActive ? 'badge-active' : 'badge-inactive'}`}>{user.isActive ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-500">{user.lastLogin ? formatDate(user.lastLogin) : 'Never'}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => deleteMutation.mutate(user._id)} className="p-1.5 rounded hover:bg-white/5 text-neutral-400 hover:text-red-400"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
