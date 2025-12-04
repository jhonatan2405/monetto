import { useState, useEffect } from 'react';
import { supabase, withTimeout, withRetry } from '../services/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { formatCurrency, formatDateOnly, formatDateTimeLocal, formatTimeOnly, exportToCSV, downloadFile, isPDF } from '../utils/format';
import { Plus, Trash2, Edit2, Loader2, X, Filter, Eye, Download } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingSpinner from '../components/LoadingSpinner';
import TableContainer from '../components/TableContainer';

export default function Expenses() {
    const { user, role } = useAuthStore();
    const [expenses, setExpenses] = useState([]);
    const [filteredExpenses, setFilteredExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewUrl, setPreviewUrl] = useState('');
    const [categories, setCategories] = useState([]);
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [editingExpense, setEditingExpense] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, expenseId: null });

    const [filters, setFilters] = useState({
        categoria_id: '',
        metodo_id: '',
        fecha_inicio: '',
        fecha_fin: '',
        estado: ''
    });

    const [formData, setFormData] = useState({
        monto: '',
        categoria_id: '',
        metodo_id: '',
        descripcion: '',
        fecha: new Date().toISOString().split('T')[0],
        estado: 'registrado',
        factura_file: null
    });

    useEffect(() => {
        const abortController = new AbortController();
        fetchExpenses(abortController.signal);
        fetchMetadata(abortController.signal);

        // Cleanup: cancelar consultas pendientes al desmontar
        return () => {
            abortController.abort();
        };
    }, []);

    useEffect(() => {
        applyFilters();
    }, [expenses, filters]);

    const fetchMetadata = async (signal) => {
        try {
            const { data: catData } = await supabase.from('categorias').select('*').eq('activa', true);
            const { data: metData } = await supabase.from('metodos_pago').select('*').eq('activo', true);
            if (!signal?.aborted) {
                setCategories(catData || []);
                setPaymentMethods(metData || []);
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error fetching metadata:', error);
            }
        }
    };

    const fetchExpenses = async (signal) => {
        try {
            let query = supabase
                .from('gastos')
                .select(`
          *,
          categorias (nombre),
          metodos_pago (nombre),
          users (email)
        `)
                .order('created_at', { ascending: false });

            if (role === 'empleado') {
                query = query.eq('usuario_id', user.id);
            }

            const { data, error } = await withRetry(() => withTimeout(query));
            if (error) throw error;

            if (!signal?.aborted) {
                setExpenses(data || []);
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                toast.error('Error al cargar gastos');
            }
        } finally {
            if (!signal?.aborted) {
                setLoading(false);
            }
        }
    };

    const applyFilters = () => {
        let filtered = [...expenses];

        if (filters.categoria_id) {
            filtered = filtered.filter(e => e.categoria_id === filters.categoria_id);
        }
        if (filters.metodo_id) {
            filtered = filtered.filter(e => e.metodo_id === filters.metodo_id);
        }
        if (filters.estado) {
            filtered = filtered.filter(e => e.estado === filters.estado);
        }
        if (filters.fecha_inicio) {
            filtered = filtered.filter(e => e.fecha >= filters.fecha_inicio);
        }
        if (filters.fecha_fin) {
            filtered = filtered.filter(e => e.fecha <= filters.fecha_fin);
        }

        setFilteredExpenses(filtered);
    };

    const clearFilters = () => {
        setFilters({
            categoria_id: '',
            metodo_id: '',
            fecha_inicio: '',
            fecha_fin: '',
            estado: ''
        });
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFormData({ ...formData, factura_file: e.target.files[0] });
        }
    };

    const openModal = (expense = null) => {
        if (expense) {
            setEditingExpense(expense);
            setFormData({
                monto: expense.monto,
                categoria_id: expense.categoria_id,
                metodo_id: expense.metodo_id,
                descripcion: expense.descripcion,
                fecha: expense.fecha,
                estado: expense.estado,
                factura_file: null
            });
        } else {
            setEditingExpense(null);
            setFormData({
                monto: '',
                categoria_id: '',
                metodo_id: '',
                descripcion: '',
                fecha: new Date().toISOString().split('T')[0],
                estado: 'registrado',
                factura_file: null
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setUploading(true);

        try {
            let factura_url = editingExpense?.factura_url || null;

            if (formData.factura_file) {
                const fileExt = formData.factura_file.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `${user.id}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('facturas')
                    .upload(filePath, formData.factura_file);

                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage
                    .from('facturas')
                    .getPublicUrl(filePath);

                factura_url = urlData.publicUrl;
            }

            const expenseData = {
                monto: formData.monto,
                categoria_id: formData.categoria_id,
                metodo_id: formData.metodo_id,
                descripcion: formData.descripcion,
                fecha: formData.fecha,
                estado: formData.estado,
                factura_url
            };

            if (editingExpense) {
                const { error } = await supabase
                    .from('gastos')
                    .update(expenseData)
                    .eq('id', editingExpense.id);

                if (error) throw error;
                toast.success('Gasto actualizado exitosamente');
            } else {
                const { error } = await supabase.from('gastos').insert([
                    {
                        ...expenseData,
                        usuario_id: user.id
                    }
                ]);

                if (error) throw error;
                toast.success('Gasto registrado exitosamente');
            }

            setIsModalOpen(false);
            setEditingExpense(null);
            fetchExpenses();
        } catch (error) {
            console.error(error);
            toast.error('Error al guardar el gasto');
        } finally {
            setUploading(false);
        }
    };

    const openDeleteConfirm = (id) => {
        setConfirmDialog({ isOpen: true, expenseId: id });
    };

    const handleDelete = async () => {
        try {
            const { error } = await supabase.from('gastos').delete().eq('id', confirmDialog.expenseId);
            if (error) throw error;
            toast.success('Gasto eliminado exitosamente');
            fetchExpenses();
        } catch (error) {
            toast.error('Error al eliminar el gasto');
        }
    };

    const openPreview = (url) => {
        setPreviewUrl(url);
        setIsPreviewOpen(true);
    };

    const getEstadoBadge = (estado) => {
        const colors = {
            aprobado: 'bg-success-100 dark:bg-success-900/30 text-success-800 dark:text-success-400',
            rechazado: 'bg-error-100 dark:bg-error-900/30 text-error-800 dark:text-error-400',
            registrado: 'bg-warning-100 dark:bg-warning-900/30 text-warning-800 dark:text-warning-400'
        };
        return (
            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${colors[estado]}`}>
                {estado.charAt(0).toUpperCase() + estado.slice(1)}
            </span>
        );
    };

    const handleExport = () => {
        const exportData = filteredExpenses.map(e => ({
            Fecha: formatDateOnly(e.fecha),
            Hora: formatTimeOnly(e.created_at),
            Descripción: e.descripcion,
            Categoría: e.categorias?.nombre,
            Monto: e.monto,
            Estado: e.estado,
            Método: e.metodos_pago?.nombre,
            Responsable: e.users?.email
        }));
        exportToCSV(exportData, 'gastos');
        toast.success('Gastos exportados exitosamente');
    };

    const handleDownload = async (url, filename) => {
        try {
            await downloadFile(url, filename);
            toast.success('Descarga iniciada');
        } catch (error) {
            toast.error('Error al descargar el archivo');
        }
    };

    if (loading) return <LoadingSpinner text="Cargando gastos..." />;

    return (
        <div className="h-full flex flex-col space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Gestión de Gastos</h1>
                <div className="flex gap-2">
                    {role === 'admin' && (
                        <button
                            onClick={handleExport}
                            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-smooth"
                        >
                            <Download className="-ml-1 mr-2 h-4 w-4" />
                            Exportar
                        </button>
                    )}
                    <button
                        onClick={() => openModal()}
                        className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 transition-smooth"
                    >
                        <Plus className="-ml-1 mr-2 h-4 w-4" />
                        Nuevo Gasto
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border border-gray-200 dark:border-gray-700">
                <div className="flex items-center mb-3">
                    <Filter className="h-4 w-4 text-gray-500 mr-2" />
                    <h3 className="text-sm font-medium text-gray-700">Filtros</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Categoría</label>
                        <select
                            className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                            value={filters.categoria_id}
                            onChange={(e) => setFilters({ ...filters, categoria_id: e.target.value })}
                        >
                            <option value="">Todas</option>
                            {categories.map(c => (
                                <option key={c.id} value={c.id}>{c.nombre}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Método de Pago</label>
                        <select
                            className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                            value={filters.metodo_id}
                            onChange={(e) => setFilters({ ...filters, metodo_id: e.target.value })}
                        >
                            <option value="">Todos</option>
                            {paymentMethods.map(m => (
                                <option key={m.id} value={m.id}>{m.nombre}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Estado</label>
                        <select
                            className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                            value={filters.estado}
                            onChange={(e) => setFilters({ ...filters, estado: e.target.value })}
                        >
                            <option value="">Todos</option>
                            <option value="registrado">Registrado</option>
                            <option value="pendiente">Pendiente</option>
                            <option value="aprobado">Aprobado</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Fecha Inicio</label>
                        <input
                            type="date"
                            className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                            value={filters.fecha_inicio}
                            onChange={(e) => setFilters({ ...filters, fecha_inicio: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Fecha Fin</label>
                        <input
                            type="date"
                            className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                            value={filters.fecha_fin}
                            onChange={(e) => setFilters({ ...filters, fecha_fin: e.target.value })}
                        />
                    </div>
                </div>
                <div className="mt-3">
                    <button
                        onClick={clearFilters}
                        className="text-sm text-primary-600 hover:text-primary-800"
                    >
                        Limpiar filtros
                    </button>
                </div>
            </div >

            {/* List */}
            <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg border border-gray-200 dark:border-gray-700">
                <TableContainer>
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-900">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hora</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Descripción</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Categoría</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Monto</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Responsable</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Factura</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {loading ? (
                                <tr><td colSpan="8" className="text-center py-4">Cargando...</td></tr>
                            ) : filteredExpenses.length === 0 ? (
                                <tr><td colSpan="8" className="text-center py-4">No hay gastos registrados</td></tr>
                            ) : (
                                filteredExpenses.map((expense) => (
                                    <tr key={expense.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {formatDateOnly(expense.fecha)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {formatTimeOnly(expense.created_at)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                            {expense.descripcion}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {expense.categorias?.nombre}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {formatCurrency(expense.monto)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            {getEstadoBadge(expense.estado)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {expense.users?.email}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {expense.factura_url ? (
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => openPreview(expense.factura_url)}
                                                        className="text-primary-600 hover:text-primary-900"
                                                        title="Ver factura"
                                                    >
                                                        <Eye className="h-5 w-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDownload(expense.factura_url, `factura_${expense.id}.pdf`)}
                                                        className="text-success-600 hover:text-success-700 dark:text-success-400 dark:hover:text-success-300"
                                                        title="Descargar factura"
                                                    >
                                                        <Download className="h-5 w-5" />
                                                    </button>
                                                </div>
                                            ) : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end gap-2">
                                                {role === 'admin' && (
                                                    <>
                                                        <button
                                                            onClick={() => openModal(expense)}
                                                            className="text-blue-600 hover:text-blue-900"
                                                            title="Editar"
                                                        >
                                                            <Edit2 className="h-5 w-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => openDeleteConfirm(expense.id)}
                                                            className="text-error-600 hover:text-error-700 dark:text-error-400 dark:hover:text-error-300 transition-smooth"
                                                            title="Eliminar"
                                                        >
                                                            <Trash2 className="h-5 w-5" />
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

            {/* Modal Create/Edit */}
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
                                        <h3 className="text-lg leading-6 font-medium text-gray-900">
                                            {editingExpense ? 'Editar Gasto' : 'Registrar Nuevo Gasto'}
                                        </h3>
                                        <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                                            <X className="h-6 w-6" />
                                        </button>
                                    </div>

                                    <form onSubmit={handleSubmit} className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Fecha</label>
                                            <input
                                                type="date"
                                                required
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                                                value={formData.fecha}
                                                onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Monto</label>
                                            <input
                                                type="number"
                                                required
                                                min="0"
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                                                value={formData.monto}
                                                onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Categoría</label>
                                            <select
                                                required
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                                                value={formData.categoria_id}
                                                onChange={(e) => setFormData({ ...formData, categoria_id: e.target.value })}
                                            >
                                                <option value="">Seleccionar...</option>
                                                {categories.map(c => (
                                                    <option key={c.id} value={c.id}>{c.nombre}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Método de Pago</label>
                                            <select
                                                required
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                                                value={formData.metodo_id}
                                                onChange={(e) => setFormData({ ...formData, metodo_id: e.target.value })}
                                            >
                                                <option value="">Seleccionar...</option>
                                                {paymentMethods.map(m => (
                                                    <option key={m.id} value={m.id}>{m.nombre}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Estado</label>
                                            <select
                                                required
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                                                value={formData.estado}
                                                onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                                            >
                                                <option value="registrado">Registrado</option>
                                                <option value="pendiente">Pendiente</option>
                                                <option value="aprobado">Aprobado</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Descripción</label>
                                            <textarea
                                                rows="3"
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                                                value={formData.descripcion}
                                                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">
                                                Factura {editingExpense && editingExpense.factura_url ? '(Cambiar)' : '(Opcional)'}
                                            </label>
                                            <input
                                                type="file"
                                                accept="image/*,application/pdf"
                                                className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                                                onChange={handleFileChange}
                                            />
                                            {editingExpense && editingExpense.factura_url && !formData.factura_file && (
                                                <p className="mt-1 text-xs text-gray-500">Factura actual: <a href={editingExpense.factura_url} target="_blank" rel="noopener noreferrer" className="text-primary-600">Ver</a></p>
                                            )}
                                        </div>

                                        <div className="mt-5 sm:mt-6">
                                            <button
                                                type="submit"
                                                disabled={uploading}
                                                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:text-sm disabled:opacity-50"
                                            >
                                                {uploading ? <Loader2 className="animate-spin h-5 w-5" /> : (editingExpense ? 'Actualizar Gasto' : 'Guardar Gasto')}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Preview Modal */}
            {
                isPreviewOpen && (
                    <div className="fixed inset-0 z-50 overflow-y-auto">
                        <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                                <div className="absolute inset-0 bg-gray-900 opacity-75" onClick={() => setIsPreviewOpen(false)}></div>
                            </div>

                            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-lg leading-6 font-medium text-gray-900">Vista Previa de Factura</h3>
                                        <button onClick={() => setIsPreviewOpen(false)} className="text-gray-400 hover:text-gray-500">
                                            <X className="h-6 w-6" />
                                        </button>
                                    </div>
                                    <div className="mt-4">
                                        {isPDF(previewUrl) ? (
                                            <iframe src={previewUrl} className="w-full h-96" title="PDF Preview" />
                                        ) : (
                                            <img src={previewUrl} alt="Factura" className="w-full h-auto max-h-96 object-contain" />
                                        )}
                                    </div>
                                    <div className="mt-4 flex justify-end">
                                        <button
                                            onClick={() => handleDownload(previewUrl, 'factura.pdf')}
                                            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
                                        >
                                            <Download className="mr-2 h-4 w-4" />
                                            Descargar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Confirm Delete Dialog */}
            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                onClose={() => setConfirmDialog({ isOpen: false, expenseId: null })}
                onConfirm={handleDelete}
                title="Eliminar Gasto"
                message="¿Estás seguro de que deseas eliminar este gasto? Esta acción no se puede deshacer."
                confirmText="Eliminar"
                cancelText="Cancelar"
                type="danger"
            />
        </div>
    );
}
