import { Route, Routes } from 'react-router-dom';

import AppLayout from './components/AppLayout';
import PublicLayout from './components/PublicLayout';
import RequireAuth from './components/RequireAuth';
import History from './routes/History';
import Log from './routes/Log';
import Login from './routes/Login';
import NotFound from './routes/NotFound';
import Profile from './routes/Profile';

export default function App() {
  return (
    <Routes>
      {/* Signed in: header + page + bottom tab bar */}
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Log />} />
          <Route path="/history" element={<History />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Route>

      {/* Signed out, and anything unknown */}
      <Route element={<PublicLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
