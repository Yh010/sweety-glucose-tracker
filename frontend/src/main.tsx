import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@fontsource-variable/manrope';
import './styles.css';
import App from './App';
import { ApiError } from './lib/api';
const client = new QueryClient({ defaultOptions: { queries: { staleTime: 15000, retry: (attempt, error) => attempt < 1 && !(error instanceof ApiError && error.status >= 400 && error.status < 500), refetchOnWindowFocus: true } } });
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={client}><App /></QueryClientProvider></React.StrictMode>);
