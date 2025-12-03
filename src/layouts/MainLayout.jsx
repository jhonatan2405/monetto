import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import {
    LayoutDashboard,
    Receipt,
    TrendingUp,
    Users,
    Settings,
    LogOut,
    Menu,
    X,
    Wallet,
    Sun,
    Moon
} from 'lucide-react';
import clsx from 'clsx';

export default function MainLayout() {
    const { role, signOut, user } = useAuthStore();
    const { theme, toggleTheme } = useThemeStore();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    const navigation = [
        { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['admin', 'empleado'] },
        { name: 'Gastos', href: '/gastos', icon: Receipt, roles: ['admin', 'empleado'] },
        { name: 'Ingresos', href: '/ingresos', icon: TrendingUp, roles: ['admin', 'empleado'] },
        { name: 'Usuarios', href: '/usuarios', icon: Users, roles: ['admin'] },
        { name: 'Configuración', href: '/configuracion', icon: Settings, roles: ['admin'] },
    ];

    const filteredNavigation = navigation.filter(item => item.roles.includes(role));

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden transition-colors">
            {/* Mobile sidebar backdrop */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                ></div>
            )}

            {/* Sidebar */}
            <div className={clsx(
                "fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 shadow-lg transform transition-all duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0 flex flex-col",
                isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                {/* Logo */}
                <div className="flex items-center justify-between h-20 px-4 bg-primary-600 text-white flex-shrink-0">
                    <div className="flex items-center space-x-3">
                        <img src="/logo.png" alt="Monetto" className="h-14 w-14" />
                        <span className="text-2xl font-bold">Monetto</span>
                    </div>
                    <button
                        className="lg:hidden"
                        onClick={() => setIsSidebarOpen(false)}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* User Info */}
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{user?.email}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{role}</p>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
                    {filteredNavigation.map((item) => {
                        const isActive = location.pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                className={clsx(
                                    isActive
                                        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100',
                                    'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors'
                                )}
                                onClick={() => setIsSidebarOpen(false)}
                            >
                                <item.icon
                                    className={clsx(
                                        isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-500',
                                        'mr-3 flex-shrink-0 h-5 w-5'
                                    )}
                                    aria-hidden="true"
                                />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>

                {/* Logout */}
                <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 space-y-2">
                    <button
                        onClick={toggleTheme}
                        className="flex items-center w-full px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        {theme === 'light' ? (
                            <><Moon className="mr-3 h-5 w-5" /> Modo Oscuro</>
                        ) : (
                            <><Sun className="mr-3 h-5 w-5" /> Modo Claro</>
                        )}
                    </button>
                    <button
                        onClick={handleSignOut}
                        className="flex items-center w-full px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                        <LogOut className="mr-3 h-5 w-5" />
                        Cerrar Sesión
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Mobile Header */}
                <div className="lg:hidden flex items-center justify-between h-14 px-4 bg-white dark:bg-gray-800 shadow-sm flex-shrink-0">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none"
                    >
                        <Menu className="h-6 w-6" />
                    </button>
                    <span className="text-lg font-bold text-gray-900 dark:text-gray-100">Monetto</span>
                    <button
                        onClick={toggleTheme}
                        className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    >
                        {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                    </button>
                </div>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 transition-colors">
                    <div className="h-full p-4 sm:p-5 lg:p-6">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}
