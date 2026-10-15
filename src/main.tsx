import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { VerificacionPublica } from './components/VerificacionPublica';
import { getVerificationToken } from './utils/qrVerification';
import './index.css';

// P4-QR: si la URL trae ?verificar=<token> (al escanear el QR del certificado)
// se muestra la vista pública de verificación, sin requerir sesión de operador.
const verificationToken = getVerificationToken();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {verificationToken ? <VerificacionPublica token={verificationToken} /> : <App />}
  </StrictMode>,
);
