import { useState, useEffect } from 'react';
import { supabase, withTimeout, withRetry } from '../../services/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { Plus, Loader2, X, UserCheck, UserX, Edit2, Key, History } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '../../utils/format';
import TableContainer from '../../components/TableContainer';

export default function Users() {
    const { user } = useAuthStore();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
    const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [userActivity, setUserActivity] = useState([]);

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        role: 'empleado'
    });

    const [editFormData, setEditFormData] = useState({
        email: '',
        role: 'empleado'
    });

    const [resetPasswordData, setResetPasswordData] = useState({
        newPassword: '',
        confirmPassword: ''
    });

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const { data, error } = await withRetry(() => withTimeout(
                supabase
                    .from('users')
                    .select('*')
                    .order('created_at', { ascending: false })
            ));

            if (error) throw error;
            setUsers(data || []);
        } catch (error) {
            toast.error('Error al cargar usuarios');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            // 1. Create user in Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
            });

            if (authError) throw authError;

            // 2. Update role in public.users
            if (formData.role === 'admin' && authData.user) {
                await new Promise(resolve => setTimeout(resolve, 1000));

                const { error: updateError } = await supabase
                    .from('users')
                    .update({ role: 'admin' })
                    .eq('id', authData.user.id);

                if (updateError) throw updateError;
            }

            toast.success('Usuario creado exitosamente');
            setIsModalOpen(false);
            setFormData({ email: '', password: '', role: 'empleado' });
            fetchUsers();
        } catch (error) {
            console.error(error);
            toast.error('Error al crear usuario: ' + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const { error } = await supabase
                .from('users')
                .update({
                    email: editFormData.email,
                    role: editFormData.role
                })
                .eq('id', selectedUser.id);

            if (error) throw error;

            toast.success('Usuario actualizado exitosamente');
            setIsEditModalOpen(false);
            setSelectedUser(null);
            fetchUsers();
        } catch (error) {
            console.error(error);
            toast.error('Error al actualizar usuario: ' + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();

        if (resetPasswordData.newPassword !== resetPasswordData.confirmPassword) {
            toast.error('Las contraseñas no coinciden');
            return;
        }

        if (resetPasswordData.newPassword.length < 6) {
            toast.error('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        setSubmitting(true);

        try {
            // Note: Supabase doesn't allow admins to directly reset passwords
            // We need to use the admin API or send a password reset email
            const { error } = await supabase.auth.admin.updateUserById(
                selectedUser.id,
                { password: resetPasswordData.newPassword }
            );

            if (error) {
                // Fallback: send password reset email
                const { error: emailError } = await supabase.auth.resetPasswordForEmail(
                    selectedUser.email,
                    { redirectTo: window.location.origin + '/reset-password' }
                );

                if (emailError) throw emailError;
                toast.success('Email de recuperación enviado al usuario');
            } else {
                toast.success('Contraseña actualizada exitosamente');
            }

            setIsResetPasswordModalOpen(false);
            setSelectedUser(null);
            setResetPasswordData({ newPassword: '', confirmPassword: '' });
        } catch (error) {
            console.error(error);
            toast.error('Error al resetear contraseña. Enviando email de recuperación...');

            // Fallback to email
            try {
                await supabase.auth.resetPasswordForEmail(selectedUser.email);
                toast.success('Email de recuperación enviado');
                setIsResetPasswordModalOpen(false);
            } catch (e) {
                toast.error('Error: ' + error.message);
            }
        } finally {
            setSubmitting(false);
        }
    };

    const fetchUserActivity = async (userId) => {
        try {
            // Fetch user's expenses and incomes
            const { data: gastos } = await supabase
                .from('gastos')
                .select('id, fecha, monto, descripcion, created_at')
                .eq('usuario_id', userId)
                .order('created_at', { ascending: false })
                .limit(20);

            const { data: ingresos } = await supabase
                .from('ingresos')
                .select('id, fecha, monto, descripcion, created_at')
                .eq('usuario_id', userId)
                .order('created_at', { ascending: false })
                .limit(20);

            const activity = [
                ...(gastos?.map(g => ({ ...g, type: 'gasto' })) || []),
                ...(ingresos?.map(i => ({ ...i, type: 'ingreso' })) || [])
            ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 20);

            setUserActivity(activity);
        } catch (error) {
            console.error(error);
            toast.error('Error al cargar actividad del usuario');
        }
    };

    const openEditModal = (u) => {
        setSelectedUser(u);
        setEditFormData({
            email: u.email,
            role: u.role
        });
        setIsEditModalOpen(true);
    };

    const openResetPasswordModal = (u) => {
        setSelectedUser(u);
        setResetPasswordData({ newPassword: '', confirmPassword: '' });
        setIsResetPasswordModalOpen(true);
    };

    const openActivityModal = async (u) => {
        setSelectedUser(u);
        setIsActivityModalOpen(true);
        await fetchUserActivity(u.id);
    };

    const toggleStatus = async (userId, currentStatus) => {
        try {
            const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
            const { error } = await supabase
                .from('users')
                .update({ status: newStatus })
                .eq('id', userId);

            if (error) throw error;
            toast.success(`Usuario ${newStatus === 'active' ? 'activado' : 'desactivado'}`);
            fetchUsers();
        } catch (error) {
            toast.error('Error al actualizar estado');
        }
    };

    return (
        <div className="h-full flex flex-col space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h1>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
                >
                    <Plus className="-ml-1 mr-2 h-4 w-4" />
                    Nuevo Usuario
                </button>
            </div>

            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <TableContainer>
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Creado</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr><td colSpan="5" className="text-center py-4">Cargando...</td></tr>
                            ) : users.length === 0 ? (
                                <tr><td colSpan="5" className="text-center py-4">No hay usuarios registrados</td></tr>
                            ) : (
                                users.map((u) => (
                                    <tr key={u.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{u.email}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{u.role}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${u.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {u.status === 'active' ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {formatDate(u.created_at)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => openActivityModal(u)}
                                                    className="text-blue-600 hover:text-blue-900"
                                                    title="Ver actividad"
                                                >
                                                    <History className="h-5 w-5" />
                                                </button>
                                                {u.id !== user.id && (
                                                    <>
                                                        <button
                                                            onClick={() => openEditModal(u)}
                                                            className="text-indigo-600 hover:text-indigo-900"
                                                            title="Editar usuario"
                                                        >
                                                            <Edit2 className="h-5 w-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => openResetPasswordModal(u)}
                                                            className="text-yellow-600 hover:text-yellow-900"
                                                            title="Resetear contraseña"
                                                        >
                                                            <Key className="h-5 w-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => toggleStatus(u.id, u.status)}
                                                            className={`${u.status === 'active' ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}`}
                                                            title={u.status === 'active' ? 'Desactivar' : 'Activar'}
                                                        >
                                                            {u.status === 'active' ? <UserX className="h-5 w-5" /> : <UserCheck className="h-5 w-5" />}
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </TableContainer>
            </div>

            {/* Create User Modal */}
            {
                isModalOpen && (
                    <div className="fixed inset-0 z-50 overflow-y-auto">
                        <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                                <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={() => setIsModalOpen(false)}></div>
                            </div>
                            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-lg leading-6 font-medium text-gray-900">Crear Nuevo Usuario</h3>
                                        <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                                            <X className="h-6 w-6" />
                                        </button>
                                    </div>
                                    <form onSubmit={handleSubmit} className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Email</label>
                                            <input
                                                type="email"
                                                required
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Contraseña</label>
                                            <input
                                                type="password"
                                                required
                                                minLength={6}
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                                                value={formData.password}
                                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Rol</label>
                                            <select
                                                required
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                                                value={formData.role}
                                                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                            >
                                                <option value="empleado">Empleado</option>
                                                <option value="admin">Administrador</option>
                                            </select>
                                        </div>
                                        <div className="mt-5 sm:mt-6">
                                            <button
                                                type="submit"
                                                disabled={submitting}
                                                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:text-sm disabled:opacity-50"
                                            >
                                                {submitting ? <Loader2 className="animate-spin h-5 w-5" /> : 'Crear Usuario'}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Edit User Modal */}
            {
                isEditModalOpen && (
                    <div className="fixed inset-0 z-50 overflow-y-auto">
                        <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                                <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={() => setIsEditModalOpen(false)}></div>
                            </div>
                            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-lg leading-6 font-medium text-gray-900">Editar Usuario</h3>
                                        <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                                            <X className="h-6 w-6" />
                                        </button>
                                    </div>
                                    <form onSubmit={handleEditSubmit} className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Email</label>
                                            <input
                                                type="email"
                                                required
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                                                value={editFormData.email}
                                                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Rol</label>
                                            <select
                                                required
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                                                value={editFormData.role}
                                                onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                                            >
                                                <option value="empleado">Empleado</option>
                                                <option value="admin">Administrador</option>
                                            </select>
                                        </div>
                                        <div className="mt-5 sm:mt-6">
                                            <button
                                                type="submit"
                                                disabled={submitting}
                                                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:text-sm disabled:opacity-50"
                                            >
                                                {submitting ? <Loader2 className="animate-spin h-5 w-5" /> : 'Actualizar Usuario'}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Reset Password Modal */}
            {
                isResetPasswordModalOpen && (
                    <div className="fixed inset-0 z-50 overflow-y-auto">
                        <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                                <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={() => setIsResetPasswordModalOpen(false)}></div>
                            </div>
                            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-lg leading-6 font-medium text-gray-900">Resetear Contraseña</h3>
                                        <button onClick={() => setIsResetPasswordModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                                            <X className="h-6 w-6" />
                                        </button>
                                    </div>
                                    <p className="text-sm text-gray-500 mb-4">Usuario: {selectedUser?.email}</p>
                                    <form onSubmit={handleResetPassword} className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Nueva Contraseña</label>
                                            <input
                                                type="password"
                                                required
                                                minLength={6}
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                                                value={resetPasswordData.newPassword}
                                                onChange={(e) => setResetPasswordData({ ...resetPasswordData, newPassword: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Confirmar Contraseña</label>
                                            <input
                                                type="password"
                                                required
                                                minLength={6}
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                                                value={resetPasswordData.confirmPassword}
                                                onChange={(e) => setResetPasswordData({ ...resetPasswordData, confirmPassword: e.target.value })}
                                            />
                                        </div>
                                        <div className="mt-5 sm:mt-6 flex gap-2">
                                            <button
                                                type="submit"
                                                disabled={submitting}
                                                className="flex-1 inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:text-sm disabled:opacity-50"
                                            >
                                                {submitting ? <Loader2 className="animate-spin h-5 w-5" /> : 'Resetear Contraseña'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    try {
                                                        await supabase.auth.resetPasswordForEmail(selectedUser.email);
                                                        toast.success('Email de recuperación enviado');
                                                        setIsResetPasswordModalOpen(false);
                                                    } catch (error) {
                                                        toast.error('Error al enviar email');
                                                    }
                                                }}
                                                className="flex-1 inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:text-sm"
                                            >
                                                Enviar Email
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Activity Modal */}
            {
                isActivityModalOpen && (
                    <div className="fixed inset-0 z-50 overflow-y-auto">
                        <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                                <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={() => setIsActivityModalOpen(false)}></div>
                            </div>
                            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-lg leading-6 font-medium text-gray-900">Historial de Actividad</h3>
                                        <button onClick={() => setIsActivityModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                                            <X className="h-6 w-6" />
                                        </button>
                                    </div>
                                    <p className="text-sm text-gray-500 mb-4">Usuario: {selectedUser?.email}</p>
                                    <TableContainer>
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {userActivity.length === 0 ? (
                                                    <tr><td colSpan="4" className="text-center py-4 text-sm text-gray-500">No hay actividad registrada</td></tr>
                                                ) : (
                                                    userActivity.map((activity, idx) => (
                                                        <tr key={idx}>
                                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                                                {formatDate(activity.fecha)}
                                                            </td>
                                                            <td className="px-4 py-2 whitespace-nowrap text-sm">
                                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${activity.type === 'ingreso' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                                    {activity.type === 'ingreso' ? 'Ingreso' : 'Gasto'}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                                                                {activity.descripcion || '-'}
                                                            </td>
                                                            <td className={`px-4 py-2 whitespace-nowrap text-sm text-right font-medium ${activity.type === 'ingreso' ? 'text-green-600' : 'text-red-600'}`}>
                                                                ${Number(activity.monto).toLocaleString('es-CO')}
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </TableContainer>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
