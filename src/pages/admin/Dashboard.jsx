import { useEffect, useState } from 'react';
import { supabase, withTimeout, withRetry } from '../../services/supabase';
import TableContainer from '../../components/TableContainer';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    LineChart,
    Line
} from 'recharts';
import { formatCurrency, formatDateTime } from '../../utils/format';
import { Loader2, TrendingDown, TrendingUp, DollarSign, ArrowUp, ArrowDown } from 'lucide-react';

export default function AdminDashboard() {
    const [stats, setStats] = useState({
        totalIngresos: 0,
        totalGastos: 0,
        balance: 0,
        topMetodos: [],
        topCategorias: [],
        monthlyTrend: [],
        recentTransactions: [],
        previousMonth: { ingresos: 0, gastos: 0 }
    });
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('month');

    // Estados para los selectores de fecha
    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());
    const [selectedWeek, setSelectedWeek] = useState(0); // Semana actual

    useEffect(() => {
        const abortController = new AbortController();
        fetchDashboardData(abortController.signal);

        // Cleanup: cancelar consultas pendientes al desmontar o cambiar período
        return () => {
            abortController.abort();
        };
    }, [period, selectedMonth, selectedYear, selectedWeek]);

    // Suppress Recharts console warnings
    useEffect(() => {
        const originalWarn = console.warn;
        console.warn = (...args) => {
            if (typeof args[0] === 'string' && args[0].includes('width(-1) and height(-1)')) {
                return;
            }
            originalWarn(...args);
        };
        return () => {
            console.warn = originalWarn;
        };
    }, []);

    const fetchDashboardData = async (signal) => {
        try {
            const today = new Date();
            let startDate, endDate, prevStartDate, prevEndDate;

            // Calcular rangos de fechas según el período seleccionado
            if (period === 'week') {
                // Semana actual o seleccionada
                const weekStart = new Date(today);
                weekStart.setDate(today.getDate() - today.getDay() + selectedWeek * 7);
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6);

                startDate = weekStart.toISOString().split('T')[0];
                endDate = weekEnd.toISOString().split('T')[0];

                // Semana anterior
                const prevWeekStart = new Date(weekStart);
                prevWeekStart.setDate(weekStart.getDate() - 7);
                const prevWeekEnd = new Date(prevWeekStart);
                prevWeekEnd.setDate(prevWeekStart.getDate() + 6);

                prevStartDate = prevWeekStart.toISOString().split('T')[0];
                prevEndDate = prevWeekEnd.toISOString().split('T')[0];
            } else if (period === 'month') {
                // Mes seleccionado
                const monthStart = new Date(selectedYear, selectedMonth, 1);
                const monthEnd = new Date(selectedYear, selectedMonth + 1, 0);

                startDate = monthStart.toISOString().split('T')[0];
                endDate = monthEnd.toISOString().split('T')[0];

                // Mes anterior
                const prevMonthStart = new Date(selectedYear, selectedMonth - 1, 1);
                const prevMonthEnd = new Date(selectedYear, selectedMonth, 0);

                prevStartDate = prevMonthStart.toISOString().split('T')[0];
                prevEndDate = prevMonthEnd.toISOString().split('T')[0];
            } else if (period === 'year') {
                // Año seleccionado
                startDate = `${selectedYear}-01-01`;
                endDate = `${selectedYear}-12-31`;

                // Año anterior
                prevStartDate = `${selectedYear - 1}-01-01`;
                prevEndDate = `${selectedYear - 1}-12-31`;
            }

            // OPTIMIZACIÓN: Obtener datos de los últimos 6 meses para la tendencia
            const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1).toISOString().split('T')[0];

            const [
                { data: ingresos },
                { data: gastos },
                { data: prevIngresos },
                { data: prevGastos },
                { data: categorias },
                { data: metodos },
                { data: allIngresos },
                { data: allGastos }
            ] = await withRetry(() => withTimeout(Promise.all([
                supabase.from('ingresos').select('monto, metodo_id, fecha, descripcion, users(email)').gte('fecha', startDate).lte('fecha', endDate),
                supabase.from('gastos').select('monto, categoria_id, metodo_id, fecha, descripcion, users(email)').gte('fecha', startDate).lte('fecha', endDate),
                supabase.from('ingresos').select('monto').gte('fecha', prevStartDate).lte('fecha', prevEndDate),
                supabase.from('gastos').select('monto').gte('fecha', prevStartDate).lte('fecha', prevEndDate),
                supabase.from('categorias').select('id, nombre'),
                supabase.from('metodos_pago').select('id, nombre'),
                // Nueva consulta única para tendencia mensual
                supabase.from('ingresos').select('monto, fecha').gte('fecha', sixMonthsAgo),
                supabase.from('gastos').select('monto, fecha').gte('fecha', sixMonthsAgo)
            ])));

            // Verificar si fue cancelado
            if (signal?.aborted) return;

            const totalIngresos = ingresos?.reduce((acc, curr) => acc + Number(curr.monto), 0) || 0;
            const totalGastos = gastos?.reduce((acc, curr) => acc + Number(curr.monto), 0) || 0;
            const prevTotalIngresos = prevIngresos?.reduce((acc, curr) => acc + Number(curr.monto), 0) || 0;
            const prevTotalGastos = prevGastos?.reduce((acc, curr) => acc + Number(curr.monto), 0) || 0;

            const catMap = {};
            gastos?.forEach(g => {
                const catName = categorias?.find(c => c.id === g.categoria_id)?.nombre || 'Desconocido';
                catMap[catName] = (catMap[catName] || 0) + Number(g.monto);
            });
            const topCategorias = Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);

            const methodMap = {};
            [...(ingresos || []), ...(gastos || [])].forEach(t => {
                const methodName = metodos?.find(m => m.id === t.metodo_id)?.nombre || 'Desconocido';
                methodMap[methodName] = (methodMap[methodName] || 0) + 1;
            });
            const topMetodos = Object.entries(methodMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);

            // OPTIMIZACIÓN: Procesar tendencia mensual desde los datos ya obtenidos
            const monthlyTrend = [];
            for (let i = 5; i >= 0; i--) {
                const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
                const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
                const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
                const monthName = monthDate.toLocaleDateString('es-CO', { month: 'short' });

                const monthIngresos = allIngresos?.filter(item => {
                    const fecha = new Date(item.fecha);
                    return fecha >= monthStart && fecha <= monthEnd;
                }) || [];

                const monthGastos = allGastos?.filter(item => {
                    const fecha = new Date(item.fecha);
                    return fecha >= monthStart && fecha <= monthEnd;
                }) || [];

                monthlyTrend.push({
                    mes: monthName,
                    ingresos: monthIngresos.reduce((acc, curr) => acc + Number(curr.monto), 0),
                    gastos: monthGastos.reduce((acc, curr) => acc + Number(curr.monto), 0)
                });
            }

            const allTransactions = [
                ...(ingresos?.map(i => ({ ...i, type: 'ingreso' })) || []),
                ...(gastos?.map(g => ({ ...g, type: 'gasto' })) || [])
            ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 10);

            if (!signal?.aborted) {
                setStats({
                    totalIngresos,
                    totalGastos,
                    balance: totalIngresos - totalGastos,
                    topCategorias,
                    topMetodos,
                    monthlyTrend,
                    recentTransactions: allTransactions,
                    previousMonth: { ingresos: prevTotalIngresos, gastos: prevTotalGastos }
                });
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error fetching dashboard data:', error);
            }
        } finally {
            if (!signal?.aborted) {
                setLoading(false);
            }
        }
    };

    const getPercentageChange = (current, previous) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous * 100).toFixed(1);
    };

    if (loading) return <div className="flex justify-center items-center p-12"><Loader2 className="animate-spin h-8 w-8 text-primary-600" /></div>;

    const ingresosChange = getPercentageChange(stats.totalIngresos, stats.previousMonth.ingresos);
    const gastosChange = getPercentageChange(stats.totalGastos, stats.previousMonth.gastos);

    return (
        <div className="h-full flex flex-col space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard General</h1>
                <div className="flex flex-col sm:flex-row gap-2">
                    {/* Period Buttons */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                setPeriod('week');
                                setSelectedWeek(0);
                            }}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${period === 'week' ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                        >
                            Semana
                        </button>
                        <button
                            onClick={() => {
                                setPeriod('month');
                                const today = new Date();
                                setSelectedMonth(today.getMonth());
                                setSelectedYear(today.getFullYear());
                            }}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${period === 'month' ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                        >
                            Mes
                        </button>
                        <button
                            onClick={() => {
                                setPeriod('year');
                                setSelectedYear(new Date().getFullYear());
                            }}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${period === 'year' ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                        >
                            Año
                        </button>
                    </div>

                    {/* Date Selectors */}
                    {period === 'week' && (
                        <div className="flex gap-2 items-center">
                            <button
                                onClick={() => setSelectedWeek(selectedWeek - 1)}
                                className="px-3 py-2 text-sm font-medium rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                                ← Anterior
                            </button>
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                {selectedWeek === 0 ? 'Semana Actual' : selectedWeek > 0 ? `+${selectedWeek} semanas` : `${selectedWeek} semanas`}
                            </span>
                            <button
                                onClick={() => setSelectedWeek(selectedWeek + 1)}
                                className="px-3 py-2 text-sm font-medium rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                                Siguiente →
                            </button>
                        </div>
                    )}

                    {period === 'month' && (
                        <div className="flex gap-2">
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                                className="px-3 py-2 text-sm font-medium rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                                {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((month, idx) => (
                                    <option key={idx} value={idx}>{month}</option>
                                ))}
                            </select>
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                className="px-3 py-2 text-sm font-medium rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {period === 'year' && (
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            className="px-3 py-2 text-sm font-medium rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                            {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {/* Ingresos Card */}
                <div className="relative overflow-hidden bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl shadow-lg hover:shadow-xl transition-shadow p-6 border border-green-100 dark:border-green-800">
                    <div className="flex items-center justify-between">
                        <div className="flex-1">
                            <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">
                                Ingresos {period === 'week' ? 'de la Semana' : period === 'month' ? 'del Mes' : 'del Año'}
                            </p>
                            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(stats.totalIngresos)}</p>
                            <div className={`flex items-center mt-2 text-sm font-medium ${ingresosChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {ingresosChange >= 0 ? <ArrowUp className="h-4 w-4 mr-1" /> : <ArrowDown className="h-4 w-4 mr-1" />}
                                {Math.abs(ingresosChange)}% vs {period === 'week' ? 'semana anterior' : period === 'month' ? 'mes anterior' : 'año anterior'}
                            </div>
                        </div>
                        <div className="flex-shrink-0">
                            <div className="p-3 bg-green-500 dark:bg-green-600 rounded-xl">
                                <TrendingUp className="h-8 w-8 text-white" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Gastos Card */}
                <div className="relative overflow-hidden bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 rounded-2xl shadow-lg hover:shadow-xl transition-shadow p-6 border border-red-100 dark:border-red-800">
                    <div className="flex items-center justify-between">
                        <div className="flex-1">
                            <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">
                                Gastos {period === 'week' ? 'de la Semana' : period === 'month' ? 'del Mes' : 'del Año'}
                            </p>
                            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(stats.totalGastos)}</p>
                            <div className={`flex items-center mt-2 text-sm font-medium ${gastosChange >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                {gastosChange >= 0 ? <ArrowUp className="h-4 w-4 mr-1" /> : <ArrowDown className="h-4 w-4 mr-1" />}
                                {Math.abs(gastosChange)}% vs {period === 'week' ? 'semana anterior' : period === 'month' ? 'mes anterior' : 'año anterior'}
                            </div>
                        </div>
                        <div className="flex-shrink-0">
                            <div className="p-3 bg-red-500 dark:bg-red-600 rounded-xl">
                                <TrendingDown className="h-8 w-8 text-white" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Balance Card */}
                <div className={`relative overflow-hidden bg-gradient-to-br ${stats.balance >= 0 ? 'from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20' : 'from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20'} rounded-2xl shadow-lg hover:shadow-xl transition-shadow p-6 border ${stats.balance >= 0 ? 'border-blue-100 dark:border-blue-800' : 'border-orange-100 dark:border-orange-800'}`}>
                    <div className="flex items-center justify-between">
                        <div className="flex-1">
                            <p className={`text-sm font-medium mb-1 ${stats.balance >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-orange-700 dark:text-orange-400'}`}>Balance</p>
                            <p className={`text-3xl font-bold ${stats.balance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {formatCurrency(stats.balance)}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                {stats.balance >= 0 ? 'Superávit' : 'Déficit'} del período
                            </p>
                        </div>
                        <div className="flex-shrink-0">
                            <div className={`p-3 rounded-xl ${stats.balance >= 0 ? 'bg-blue-500 dark:bg-blue-600' : 'bg-orange-500 dark:bg-orange-600'}`}>
                                <DollarSign className="h-8 w-8 text-white" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Monthly Trend Chart */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Tendencia Mensual (Últimos 6 Meses)</h3>
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={stats.monthlyTrend}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                            <XAxis dataKey="mes" stroke="#6B7280" />
                            <YAxis stroke="#6B7280" />
                            <Tooltip
                                formatter={(value) => formatCurrency(value)}
                                contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '0.5rem', color: '#F3F4F6' }}
                            />
                            <Legend />
                            <Line type="monotone" dataKey="ingresos" stroke="#10b981" name="Ingresos" strokeWidth={3} dot={{ r: 5 }} />
                            <Line type="monotone" dataKey="gastos" stroke="#ef4444" name="Gastos" strokeWidth={3} dot={{ r: 5 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Categories Chart */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Gastos por Categoría</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.topCategorias}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                                <XAxis dataKey="name" stroke="#6B7280" />
                                <YAxis stroke="#6B7280" />
                                <Tooltip
                                    formatter={(value) => formatCurrency(value)}
                                    contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '0.5rem', color: '#F3F4F6' }}
                                />
                                <Bar dataKey="value" fill="#0ea5e9" name="Monto" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Payment Methods Chart */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Métodos de Pago Más Usados</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.topMetodos} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                                <XAxis type="number" stroke="#6B7280" />
                                <YAxis dataKey="name" type="category" width={120} stroke="#6B7280" />
                                <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '0.5rem', color: '#F3F4F6' }} />
                                <Bar dataKey="value" fill="#8b5cf6" name="Transacciones" radius={[0, 8, 8, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-white dark:bg-gray-800 shadow-lg rounded-2xl border border-gray-200 dark:border-gray-700">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Registros Recientes</h3>
                </div>
                <TableContainer>
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-900">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tipo</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Descripción</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Responsable</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Monto</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {stats.recentTransactions.map((transaction, idx) => (
                                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                        {formatDateTime(transaction.fecha)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${transaction.type === 'ingreso' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'}`}>
                                            {transaction.type === 'ingreso' ? 'Ingreso' : 'Gasto'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                                        {transaction.descripcion || '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                        {transaction.users?.email || '-'}
                                    </td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${transaction.type === 'ingreso' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {transaction.type === 'ingreso' ? '+' : '-'}{formatCurrency(transaction.monto)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </TableContainer>
            </div>
        </div>
    );
}
