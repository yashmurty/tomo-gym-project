import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../lib/auth-context';

export default function RequireAuth() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    const from = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?from=${from}`} replace />;
  }

  return <Outlet />;
}
