import { useState, useEffect, useCallback } from 'react';
import { supabase, withTimeout, withRetry } from '../services/supabase';
import { dedupeQuery, clearQueryCache } from '../utils/queryDedupe';
import { usePageVisibility } from '../hooks/usePageVisibility';
import { useAuthStore } from '../store/useAuthStore';
import { formatCurrency, formatDateTime, exportToCSV } from '../utils/format';
import { Plus, Trash2, Edit2, Loader2, X, Filter, Eye, Download } from 'lucide-react';
import { toast } from 'sonner';
import TableContainer from '../components/TableContainer';

export default function Incomes() {
    const { user, role } = useAuthStore();
    const [incomes, setIncomes] = useState([]);
    const [filteredIncomes, setFilteredIncomes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewUrl, setPreviewUrl] = useState('');
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [editingIncome, setEditingIncome] = useState(null);

    const [filters, setFilters] = useState({
        metodo_id: '',
        tipo: '',
        fecha_inicio: '',
        fecha_fin: ''
    });

    const [formData, setFormData] = useState({
        monto: '',
        metodo_id: '',
        descripcion: '',
        tipo: 'Venta',
        origen: '',
        fecha: new Date().toISOString().split('T')[0],
        archivo_file: null
    });

    // Función para recargar datos
    const reloadData = useCallback(() => {
        console.log('🔄 Recargando ingresos...');
        clearQueryCache('ingresos');
        const abortController = new AbortController();
        fetchIncomes(abortController.signal);
    }, []);

    // Detectar cuando el usuario vuelve a la pestaña
    usePageVisibility(reloadData);

    useEffect(() => {
        const abortController = new AbortController();
        fetchIncomes(abortController.signal);
        fetchMetadata(abortController.signal);

        // Cleanup: cancelar consultas pendientes al desmontar
        return () => {
            abortController.abort();
        };
    }, []);

    useEffect(() => {
        applyFilters();
    }, [incomes, filters]);

    const fetchMetadata = async (signal) => {
        try {
            const queryKey = 'metadata_metodos_pago';
            const { data: metData } = await dedupeQuery(queryKey, () =>
                supabase.from('metodos_pago').select('*').eq('activo', true)
            );
            if (!signal?.aborted) {
                setPaymentMethods(metData || []);
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error fetching metadata:', error);
            }
        }
    };

    const fetchIncomes = async (signal) => {
        try {
            let query = supabase
                .from('ingresos')
                .select(`
          *,
          metodos_pago (nombre),
          users (email)
        `)
                .order('fecha', { ascending: false });

            if (role === 'empleado') {
                query = query.eq('usuario_id', user.id);
            }

            const queryKey = `ingresos_${role}_${user.id}`;
            const { data, error } = await dedupeQuery(queryKey, () =>
                withRetry(() => withTimeout(query))
            );

            if (error) {
                console.error('Error fetching incomes:', error);
                console.error('Error details:', {
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code
                });
                throw error;
            }

            if (!signal?.aborted) {
                setIncomes(data || []);
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error al cargar ingresos:', error);
                toast.error('Error al cargar ingresos. Por favor, verifica la consola para más detalles.');
            }
        } finally {
            if (!signal?.aborted) {
                setLoading(false);
            }
        }
    };

    const applyFilters = () => {
        let filtered = [...incomes];

        if (filters.metodo_id) {
            filtered = filtered.filter(i => i.metodo_id === filters.metodo_id);
        }
        if (filters.tipo) {
            filtered = filtered.filter(i => i.tipo === filters.tipo);
        }
        if (filters.fecha_inicio) {
            filtered = filtered.filter(i => i.fecha >= filters.fecha_inicio);
        }
        if (filters.fecha_fin) {
            filtered = filtered.filter(i => i.fecha <= filters.fecha_fin);
        }

        setFilteredIncomes(filtered);
    };

    const clearFilters = () => {
        setFilters({
            metodo_id: '',
            tipo: '',
            fecha_inicio: '',
            fecha_fin: ''
        });
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFormData({ ...formData, archivo_file: e.target.files[0] });
        }
    };

    const openModal = (income = null) => {
        if (income) {
            setEditingIncome(income);
            setFormData({
                monto: income.monto,
                metodo_id: income.metodo_id,
                descripcion: income.descripcion,
                tipo: income.tipo,
                origen: income.origen,
                fecha: income.fecha,
                archivo_file: null
            });
        } else {
            setEditingIncome(null);
            setFormData({
                monto: '',
                metodo_id: '',
                descripcion: '',
                tipo: 'Venta',
                origen: '',
                fecha: new Date().toISOString().split('T')[0],
                archivo_file: null
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            let archivo_url = editingIncome?.archivo_url || null;

            if (formData.archivo_file) {
                const fileExt = formData.archivo_file.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `${user.id}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('comprobantes')
                    .upload(filePath, formData.archivo_file);

                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage
                    .from('comprobantes')
                    .getPublicUrl(filePath);

                archivo_url = urlData.publicUrl;
            }

            const incomeData = {
                monto: formData.monto,
                metodo_id: formData.metodo_id,
                descripcion: formData.descripcion,
                tipo: formData.tipo,
                origen: formData.origen,
                fecha: formData.fecha,
                archivo_url
            };

            if (editingIncome) {
                const { error } = await supabase
                    .from('ingresos')
                    .update(incomeData)
                    .eq('id', editingIncome.id);

                if (error) throw error;
                toast.success('Ingreso actualizado exitosamente');
            } else {
                const { error } = await supabase.from('ingresos').insert([
                    {
                        ...incomeData,
                        usuario_id: user.id
                    }
                ]);

                if (error) throw error;
                toast.success('Ingreso registrado exitosamente');
            }

            // Invalidar caché para forzar recarga
            clearQueryCache('ingresos');
            clearQueryCache('dashboard');

            setIsModalOpen(false);
            setEditingIncome(null);
            fetchIncomes();
        } catch (error) {
            console.error(error);
            toast.error('Error al guardar el ingreso');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Estás seguro de eliminar este ingreso?')) return;

        try {
            const { error } = await supabase.from('ingresos').delete().eq('id', id);
            if (error) throw error;

            // Invalidar caché
            clearQueryCache('ingresos');
            clearQueryCache('dashboard');

            toast.success('Ingreso eliminado');
            fetchIncomes();
        } catch (error) {
            toast.error('Error al eliminar');
        }
    };

    const openPreview = (url) => {
        setPreviewUrl(url);
        setIsPreviewOpen(true);
    };

    const handleExport = () => {
        const exportData = filteredIncomes.map(i => ({
            Fecha: i.fecha,
            Descripción: i.descripcion,
            Tipo: i.tipo,
            Origen: i.origen,
            Monto: i.monto,
            Método: i.metodos_pago?.nombre,
            Responsable: i.users?.email
        }));
        exportToCSV(exportData, 'ingresos');
        toast.success('Ingresos exportados exitosamente');
    };

    return (
        <div className="h-full flex flex-col space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Gestión de Ingresos</h1>
                <div className="flex gap-2">
                    {role === 'admin' && (
                        <button
                            onClick={handleExport}
                            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                        >
                            <Download className="-ml-1 mr-2 h-4 w-4" />
                            Exportar
                        </button>
                    )}
                    <button
                        onClick={() => openModal()}
                        className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
                    >
                        <Plus className="-ml-1 mr-2 h-4 w-4" />
                        Nuevo Ingreso
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border border-gray-200 dark:border-gray-700">
                <div className="flex items-center mb-3">
                    <Filter className="h-4 w-4 text-gray-500 mr-2" />
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Filtros</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Tipo</label>
                        <select
                            className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                            value={filters.tipo}
                            onChange={(e) => setFilters({ ...filters, tipo: e.target.value })}
                        >
                            <option value="">Todos</option>
                            <option value="Venta">Venta</option>
                            <option value="Servicio">Servicio</option>
                            <option value="Otro">Otro</option>
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
            </div>

            {/* List */}
            <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg border border-gray-200 dark:border-gray-700">
                <TableContainer>
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-900">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Descripción</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tipo</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Origen</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Monto</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Método</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Responsable</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Archivo</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {loading ? (
                                <tr><td colSpan="9" className="text-center py-4">Cargando...</td></tr>
                            ) : filteredIncomes.length === 0 ? (
                                <tr><td colSpan="9" className="text-center py-4">No hay ingresos registrados</td></tr>
                            ) : (
                                filteredIncomes.map((income) => (
                                    <tr key={income.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {formatDateTime(income.fecha)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                            {income.descripcion}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {income.tipo}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {income.origen || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                                            {formatCurrency(income.monto)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {income.metodos_pago?.nombre}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {income.users?.email}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {income.archivo_url ? (
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => openPreview(income.archivo_url)}
                                                        className="text-primary-600 hover:text-primary-900"
                                                        title="Ver archivo"
                                                    >
                                                        <Eye className="h-5 w-5" />
                                                    </button>
                                                    <a
                                                        href={income.archivo_url}
                                                        download
                                                        className="text-green-600 hover:text-green-900"
                                                        title="Descargar archivo"
                                                    >
                                                        <Download className="h-5 w-5" />
                                                    </a>
                                                </div>
                                            ) : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end gap-2">
                                                {role === 'admin' && (
                                                    <>
                                                        <button
                                                            onClick={() => openModal(income)}
                                                            className="text-blue-600 hover:text-blue-900"
                                                            title="Editar"
                                                        >
                                                            <Edit2 className="h-5 w-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(income.id)}
                                                            className="text-red-600 hover:text-red-900"
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
                                            {editingIncome ? 'Editar Ingreso' : 'Registrar Nuevo Ingreso'}
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
                                            <label className="block text-sm font-medium text-gray-700">Tipo de Ingreso</label>
                                            <select
                                                required
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                                                value={formData.tipo}
                                                onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                                            >
                                                <option value="Venta">Venta</option>
                                                <option value="Servicio">Servicio</option>
                                                <option value="Otro">Otro</option>
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
                                            <label className="block text-sm font-medium text-gray-700">Origen (Cliente/Fuente)</label>
                                            <input
                                                type="text"
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                                                value={formData.origen}
                                                onChange={(e) => setFormData({ ...formData, origen: e.target.value })}
                                                placeholder="Ej: Cliente ABC, Venta Online"
                                            />
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
                                                Comprobante {editingIncome && editingIncome.archivo_url ? '(Cambiar)' : '(Opcional)'}
                                            </label>
                                            <input
                                                type="file"
                                                accept="image/*,application/pdf"
                                                className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                                                onChange={handleFileChange}
                                            />
                                            {editingIncome && editingIncome.archivo_url && !formData.archivo_file && (
                                                <p className="mt-1 text-xs text-gray-500">Archivo actual: <a href={editingIncome.archivo_url} target="_blank" rel="noopener noreferrer" className="text-primary-600">Ver</a></p>
                                            )}
                                        </div>

                                        <div className="mt-5 sm:mt-6">
                                            <button
                                                type="submit"
                                                disabled={submitting}
                                                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:text-sm disabled:opacity-50"
                                            >
                                                {submitting ? <Loader2 className="animate-spin h-5 w-5" /> : (editingIncome ? 'Actualizar Ingreso' : 'Guardar Ingreso')}
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
                                        <h3 className="text-lg leading-6 font-medium text-gray-900">Vista Previa de Comprobante</h3>
                                        <button onClick={() => setIsPreviewOpen(false)} className="text-gray-400 hover:text-gray-500">
                                            <X className="h-6 w-6" />
                                        </button>
                                    </div>
                                    <div className="mt-4">
                                        {previewUrl.endsWith('.pdf') ? (
                                            <iframe src={previewUrl} className="w-full h-96" title="PDF Preview" />
                                        ) : (
                                            <img src={previewUrl} alt="Comprobante" className="w-full h-auto max-h-96 object-contain" />
                                        )}
                                    </div>
                                    <div className="mt-4 flex justify-end">
                                        <a
                                            href={previewUrl}
                                            download
                                            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
                                        >
                                            <Download className="mr-2 h-4 w-4" />
                                            Descargar
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
}
