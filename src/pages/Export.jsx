import { useState, useEffect } from 'react';
import { supabase, withTimeout, withRetry } from '../services/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { formatCurrency, formatDateOnly, formatDateTimeLocal, formatTimeOnly, exportToCSV } from '../utils/format';
import { Download, Calendar, FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Export() {
    const { user, role } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState('');
    const [selectedYear, setSelectedYear] = useState('');

    useEffect(() => {
        // Set default to current month/year
        const now = new Date();
        setSelectedMonth(String(now.getMonth() + 1).padStart(2, '0'));
        setSelectedYear(String(now.getFullYear()));
    }, []);

    const handleExportMonth = async () => {
        if (!selectedMonth || !selectedYear) {
            toast.error('Por favor selecciona mes y año');
            return;
        }

        setLoading(true);
        try {
            // Calculate date range
            const startDate = `${selectedYear}-${selectedMonth}-01`;
            const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
            const endDate = `${selectedYear}-${selectedMonth}-${lastDay}`;

            // Fetch expenses
            let expensesQuery = supabase
                .from('gastos')
                .select(`
                    *,
                    categorias (nombre),
                    metodos_pago (nombre),
                    users (email),
                    created_at
                `)
                .gte('fecha', startDate)
                .lte('fecha', endDate)
                .order('fecha', { ascending: true });

            if (role === 'empleado') {
                expensesQuery = expensesQuery.eq('usuario_id', user.id);
            }

            const { data: expenses, error: expensesError } = await withRetry(() =>
                withTimeout(expensesQuery)
            );

            if (expensesError) throw expensesError;

            // Fetch incomes
            let incomesQuery = supabase
                .from('ingresos')
                .select(`
                    *,
                    metodos_pago (nombre),
                    users (email),
                    created_at
                `)
                .gte('fecha', startDate)
                .lte('fecha', endDate)
                .order('fecha', { ascending: true });

            if (role === 'empleado') {
                incomesQuery = incomesQuery.eq('usuario_id', user.id);
            }

            const { data: incomes, error: incomesError } = await withRetry(() =>
                withTimeout(incomesQuery)
            );

            if (incomesError) throw incomesError;

            // Calculate totals
            const totalExpenses = expenses?.reduce((sum, e) => sum + Number(e.monto), 0) || 0;
            const totalIncomes = incomes?.reduce((sum, i) => sum + Number(i.monto), 0) || 0;
            const balance = totalIncomes - totalExpenses;

            // Prepare export data
            const exportData = [];

            // Add summary header
            exportData.push({
                Tipo: '=== RESUMEN DEL MES ===',
                Fecha: '',
                Hora: '',
                Descripción: '',
                Categoría: '',
                Monto: '',
                Método: '',
                Responsable: ''
            });

            exportData.push({
                Tipo: 'Total Ingresos',
                Fecha: '',
                Hora: '',
                Descripción: '',
                Categoría: '',
                Monto: totalIncomes,
                Método: '',
                Responsable: ''
            });

            exportData.push({
                Tipo: 'Total Gastos',
                Fecha: '',
                Hora: '',
                Descripción: '',
                Categoría: '',
                Monto: totalExpenses,
                Método: '',
                Responsable: ''
            });

            exportData.push({
                Tipo: 'Balance',
                Fecha: '',
                Hora: '',
                Descripción: '',
                Categoría: '',
                Monto: balance,
                Método: '',
                Responsable: ''
            });

            exportData.push({
                Tipo: '',
                Fecha: '',
                Hora: '',
                Descripción: '',
                Categoría: '',
                Monto: '',
                Método: '',
                Responsable: ''
            });

            // Add incomes section
            exportData.push({
                Tipo: '=== INGRESOS ===',
                Fecha: '',
                Hora: '',
                Descripción: '',
                Categoría: '',
                Monto: '',
                Método: '',
                Responsable: ''
            });

            incomes?.forEach(income => {
                exportData.push({
                    Tipo: income.tipo,
                    Fecha: formatDateOnly(income.fecha),
                    Hora: formatTimeOnly(income.created_at),
                    Descripción: income.descripcion,
                    Categoría: income.origen || '-',
                    Monto: income.monto,
                    Método: income.metodos_pago?.nombre,
                    Responsable: income.users?.email
                });
            });

            exportData.push({
                Tipo: '',
                Fecha: '',
                Hora: '',
                Descripción: '',
                Categoría: '',
                Monto: '',
                Método: '',
                Responsable: ''
            });

            // Add expenses section
            exportData.push({
                Tipo: '=== GASTOS ===',
                Fecha: '',
                Hora: '',
                Descripción: '',
                Categoría: '',
                Monto: '',
                Método: '',
                Responsable: ''
            });

            expenses?.forEach(expense => {
                exportData.push({
                    Tipo: expense.estado,
                    Fecha: formatDateOnly(expense.fecha),
                    Hora: formatTimeOnly(expense.created_at),
                    Descripción: expense.descripcion,
                    Categoría: expense.categorias?.nombre,
                    Monto: expense.monto,
                    Método: expense.metodos_pago?.nombre,
                    Responsable: expense.users?.email
                });
            });

            // Export to CSV
            const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            const monthName = monthNames[parseInt(selectedMonth) - 1];
            const filename = `reporte_${monthName}_${selectedYear}`;

            exportToCSV(exportData, filename);
            toast.success(`Reporte de ${monthName} ${selectedYear} exportado exitosamente`);

        } catch (error) {
            console.error('Error exporting data:', error);
            toast.error('Error al exportar los datos');
        } finally {
            setLoading(false);
        }
    };

    // Generate year options (current year and 2 years back)
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear - 1, currentYear - 2];

    const months = [
        { value: '01', label: 'Enero' },
        { value: '02', label: 'Febrero' },
        { value: '03', label: 'Marzo' },
        { value: '04', label: 'Abril' },
        { value: '05', label: 'Mayo' },
        { value: '06', label: 'Junio' },
        { value: '07', label: 'Julio' },
        { value: '08', label: 'Agosto' },
        { value: '09', label: 'Septiembre' },
        { value: '10', label: 'Octubre' },
        { value: '11', label: 'Noviembre' },
        { value: '12', label: 'Diciembre' }
    ];

    return (
        <div className="h-full flex flex-col space-y-6 animate-fadeIn">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Exportar Reportes</h1>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Exporta reportes mensuales consolidados de ingresos y gastos
                </p>
            </div>

            {/* Export Card */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="px-6 py-5">
                    <div className="flex items-center mb-4">
                        <FileSpreadsheet className="h-6 w-6 text-primary-600 mr-3" />
                        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                            Reporte Mensual
                        </h2>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    <Calendar className="inline h-4 w-4 mr-1" />
                                    Mes
                                </label>
                                <select
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                >
                                    {months.map(month => (
                                        <option key={month.value} value={month.value}>
                                            {month.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    <Calendar className="inline h-4 w-4 mr-1" />
                                    Año
                                </label>
                                <select
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(e.target.value)}
                                    className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                >
                                    {years.map(year => (
                                        <option key={year} value={year}>
                                            {year}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="pt-4">
                            <button
                                onClick={handleExportMonth}
                                disabled={loading}
                                className="w-full inline-flex justify-center items-center px-4 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-smooth"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5" />
                                        Generando reporte...
                                    </>
                                ) : (
                                    <>
                                        <Download className="-ml-1 mr-3 h-5 w-5" />
                                        Exportar Reporte
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Info Card */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <FileSpreadsheet className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="ml-3">
                        <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300">
                            Información del Reporte
                        </h3>
                        <div className="mt-2 text-sm text-blue-700 dark:text-blue-400">
                            <ul className="list-disc list-inside space-y-1">
                                <li>El reporte incluye todos los ingresos y gastos del mes seleccionado</li>
                                <li>Se exporta en formato CSV compatible con Excel</li>
                                <li>Incluye un resumen con totales y balance del mes</li>
                                <li>Los datos están organizados por tipo (Ingresos/Gastos)</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
