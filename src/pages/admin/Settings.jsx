import { useState, useEffect } from 'react';
import { supabase, withTimeout, withRetry } from '../../services/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { Plus, Trash2, Loader2, X, ToggleLeft, ToggleRight, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function Settings() {
    const { user, role } = useAuthStore();
    const [categories, setCategories] = useState([]);
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modal states
    const [isCatModalOpen, setIsCatModalOpen] = useState(false);
    const [isMethodModalOpen, setIsMethodModalOpen] = useState(false);
    const [newItemName, setNewItemName] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const { data: catData } = await withRetry(() => withTimeout(supabase.from('categorias').select('*').order('created_at')));
            const { data: metData } = await withRetry(() => withTimeout(supabase.from('metodos_pago').select('*').order('created_at')));

            setCategories(catData || []);
            setPaymentMethods(metData || []);
        } catch (error) {
            toast.error('Error al cargar configuración');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateCategory = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const { error } = await supabase.from('categorias').insert([{
                nombre: newItemName,
                creador_id: user.id
            }]);
            if (error) throw error;
            toast.success('Categoría creada');
            setIsCatModalOpen(false);
            setNewItemName('');
            fetchData();
        } catch (error) {
            console.error('Error creating category:', error);
            toast.error(`Error al crear categoría: ${error.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    const handleCreateMethod = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const { error } = await supabase.from('metodos_pago').insert([{ nombre: newItemName }]);
            if (error) throw error;
            toast.success('Método de pago creado');
            setIsMethodModalOpen(false);
            setNewItemName('');
            fetchData();
        } catch (error) {
            console.error('Error creating payment method:', error);
            toast.error(`Error al crear método: ${error.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    const toggleCategory = async (id, currentStatus) => {
        try {
            const { error } = await supabase.from('categorias').update({ activa: !currentStatus }).eq('id', id);
            if (error) throw error;
            fetchData();
        } catch (error) {
            toast.error('Error al actualizar');
        }
    };

    const toggleMethod = async (id, currentStatus) => {
        try {
            const { error } = await supabase.from('metodos_pago').update({ activo: !currentStatus }).eq('id', id);
            if (error) throw error;
            fetchData();
        } catch (error) {
            toast.error('Error al actualizar');
        }
    };

    const refreshRole = async () => {
        try {
            const { data: userData, error } = await withRetry(() => withTimeout(
                supabase
                    .from('users')
                    .select('role, email, status')
                    .eq('id', user.id)
                    .single()
            ));

            if (error) throw error;

            if (userData) {
                // Manually update the auth store
                useAuthStore.setState({ role: userData.role });
                toast.success(`Rol actualizado: ${userData.role}`);
                console.log('User data from DB:', userData);
            }
        } catch (error) {
            console.error('Error refreshing role:', error);
            toast.error('Error al actualizar rol: ' + error.message);
        }
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="space-y-4 animate-fadeIn">
            <h1 className="text-2xl font-bold text-gray-900">Configuración del Sistema</h1>

            {/* User Profile Section */}
            <div className="bg-white shadow rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-medium text-gray-900">Perfil de Usuario</h2>
                    <button
                        onClick={refreshRole}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                        <RefreshCw className="-ml-0.5 mr-2 h-4 w-4" />
                        Actualizar Rol
                    </button>
                </div>
                <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded-md bg-gray-50">
                        <span className="text-sm font-medium text-gray-600">Email:</span>
                        <span className="text-sm text-gray-900">{user?.email}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-md bg-gray-50">
                        <span className="text-sm font-medium text-gray-600">Rol Actual:</span>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                            {role === 'admin' ? 'Administrador' : 'Empleado'}
                        </span>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-md bg-gray-50">
                        <span className="text-sm font-medium text-gray-600">ID de Usuario:</span>
                        <span className="text-xs text-gray-500 font-mono">{user?.id}</span>
                    </div>
                </div>
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-xs text-blue-800">
                        <strong>Nota:</strong> Si cambiaste tu rol directamente en la base de datos, usa el botón "Actualizar Rol" para refrescar tu sesión.
                    </p>
                </div>
            </div>

            {/* Categories Section */}
            <div className="bg-white shadow rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-medium text-gray-900">Categorías de Gastos</h2>
                    <button
                        onClick={() => setIsCatModalOpen(true)}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
                    >
                        <Plus className="-ml-0.5 mr-2 h-4 w-4" />
                        Nueva
                    </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categories.map((cat) => (
                        <div key={cat.id} className="flex items-center justify-between p-3 border rounded-md bg-gray-50">
                            <span className={`text-sm font-medium ${cat.activa ? 'text-gray-900' : 'text-gray-400'}`}>
                                {cat.nombre}
                            </span>
                            <button onClick={() => toggleCategory(cat.id, cat.activa)} className="text-gray-500 hover:text-primary-600">
                                {cat.activa ? <ToggleRight className="h-6 w-6 text-green-500" /> : <ToggleLeft className="h-6 w-6 text-gray-400" />}
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Payment Methods Section */}
            <div className="bg-white shadow rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-medium text-gray-900">Métodos de Pago</h2>
                    <button
                        onClick={() => setIsMethodModalOpen(true)}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
                    >
                        <Plus className="-ml-0.5 mr-2 h-4 w-4" />
                        Nuevo
                    </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {paymentMethods.map((method) => (
                        <div key={method.id} className="flex items-center justify-between p-3 border rounded-md bg-gray-50">
                            <span className={`text-sm font-medium ${method.activo ? 'text-gray-900' : 'text-gray-400'}`}>
                                {method.nombre}
                            </span>
                            <button onClick={() => toggleMethod(method.id, method.activo)} className="text-gray-500 hover:text-primary-600">
                                {method.activo ? <ToggleRight className="h-6 w-6 text-green-500" /> : <ToggleLeft className="h-6 w-6 text-gray-400" />}
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Generic Modal for Creation */}
            {(isCatModalOpen || isMethodModalOpen) && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                            <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={() => { setIsCatModalOpen(false); setIsMethodModalOpen(false); }}></div>
                        </div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-sm sm:w-full">
                            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                                    {isCatModalOpen ? 'Nueva Categoría' : 'Nuevo Método de Pago'}
                                </h3>
                                <form onSubmit={isCatModalOpen ? handleCreateCategory : handleCreateMethod}>
                                    <input
                                        type="text"
                                        required
                                        className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                                        placeholder="Nombre"
                                        value={newItemName}
                                        onChange={(e) => setNewItemName(e.target.value)}
                                    />
                                    <div className="mt-5 sm:mt-6 flex gap-2">
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:text-sm"
                                        >
                                            {submitting ? <Loader2 className="animate-spin h-5 w-5" /> : 'Guardar'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setIsCatModalOpen(false); setIsMethodModalOpen(false); }}
                                            className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:text-sm"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
