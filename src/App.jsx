import { useState } from 'react';
import Layout from './Layout';
import Login from './Login';
import { supabase } from './supabaseClient';

const SESSION_KEY = 'inspecortr_rrhh_session';

const getInitialSession = () => {
  try {
    const rawSession = localStorage.getItem(SESSION_KEY);
    if (!rawSession) return null;
    return JSON.parse(rawSession);
  } catch (error) {
    console.error('No se pudo leer la sesion local:', error);
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
};

function App() {
  const [loggedUser, setLoggedUser] = useState(getInitialSession);

  const handleSignIn = async ({ email, password }) => {
    const sanitizedEmail = String(email ?? '').trim().toLowerCase();
    const sanitizedPassword = String(password ?? '').trim();

    if (!sanitizedEmail || !sanitizedPassword) {
      throw new Error('Debes completar correo y contrasena.');
    }

    const { data, error } = await supabase.rpc('rrhh_login', {
      p_correo: sanitizedEmail,
      p_contrasena: sanitizedPassword,
    });

    if (error) {
      throw new Error(`No se pudo validar el acceso: ${error.message}`);
    }

    const user = data?.[0];
    if (!user) {
      throw new Error('Correo o contrasena incorrectos.');
    }

    if (user.activo === false) {
      throw new Error('Tu usuario esta deshabilitado. Contacta mantenimiento.');
    }

    const sessionUser = {
      id: user.id,
      correo: user.correo,
      nombre: user.nombre || 'Usuario RRHH',
      loginAt: new Date().toISOString(),
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
    setLoggedUser(sessionUser);
  };

  const handleSignOut = () => {
    localStorage.removeItem(SESSION_KEY);
    setLoggedUser(null);
  };

  if (!loggedUser) {
    return <Login onSignIn={handleSignIn} />;
  }

  return <Layout userEmail={loggedUser.correo} onSignOut={handleSignOut} />;
}

export default App;