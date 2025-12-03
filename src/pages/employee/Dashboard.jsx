import { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { formatCurrency, formatDate } from '../../utils/format';
import { Loader2, TrendingDown, TrendingUp } from 'lucide-react';

export default function EmployeeDashboard() {
    const { user } = useAuthStore();
    const [stats, setStats] = useState({
        myIngresos: 0,
        myGastos: 0,
        recentActivity: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) fetchMyStats();
    }, [user]);

    const fetchMyStats = async () => {
        try {
            const today = new Date();
            const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

            // My Incomes
            const { data: ingresos } = await supabase
                .from('ingresos')
                .select('*')
                .eq('usuario_id', user.id)
                .gte('created_at', firstDayOfMonth)
                .order('created_at', { ascending: false });

            // My Expenses
            const { data: gastos } = await supabase
                .from('gastos')
                .select('*')
                .eq('usuario_id', user.id)
                .gte('created_at', firstDayOfMonth)
                .order('created_at', { ascending: false });

            const totalIngresos = ingresos?.reduce((acc, curr) => acc + Number(curr.monto), 0) || 0;
            const totalGastos = gastos?.reduce((acc, curr) => acc + Number(curr.monto), 0) || 0;

            // Combine and sort recent activity
            const activity = [
                ...(ingresos?.map(i => ({ ...i, type: 'ingreso' })) || []),
                ...(gastos?.map(g => ({ ...g, type: 'gasto' })) || [])
            ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10);

            setStats({
                myIngresos: totalIngresos,
                myGastos: totalGastos,
                recentActivity: activity
            });
        } catch (error) {
            console.error('Error fetching employee stats:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Mi Resumen Mensual</h1>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <TrendingUp className="h-6 w-6 text-green-500" />
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">Mis Ingresos Registrados</dt>
                                    <dd className="text-lg font-medium text-gray-900">{formatCurrency(stats.myIngresos)}</dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <TrendingDown className="h-6 w-6 text-red-500" />
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">Mis Gastos Registrados</dt>
                                    <dd className="text-lg font-medium text-gray-900">{formatCurrency(stats.myGastos)}</dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:px-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Actividad Reciente</h3>
                </div>
                <div className="border-t border-gray-200">
                    <ul className="divide-y divide-gray-200">
                        {stats.recentActivity.map((item) => (
                            <li key={item.id} className="px-4 py-4 sm:px-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <p className="text-sm font-medium text-gray-900 truncate">
                                            {item.descripcion || 'Sin descripción'}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {formatDate(item.created_at)}
                                        </p>
                                    </div>
                                    <div className="flex items-center">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${item.type === 'ingreso' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                            }`}>
                                            {item.type === 'ingreso' ? '+' : '-'} {formatCurrency(item.monto)}
                                        </span>
                                    </div>
                                </div>
                            </li>
                        ))}
                        {stats.recentActivity.length === 0 && (
                            <li className="px-4 py-8 text-center text-gray-500">No hay actividad reciente</li>
                        )}
                    </ul>
                </div>
            </div>
        </div>
    );
}
