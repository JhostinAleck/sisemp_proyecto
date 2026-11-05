import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { StoreProvider } from './data/store';
import { Comparador } from './pages/Comparador';
import { Desglose } from './pages/Desglose';
import { InventoryCheck } from './pages/InventoryCheck';
import { ItemDetail } from './pages/ItemDetail';
import { InventoryList, Quotes, Suppliers } from './pages/Lists';
import { Login } from './pages/Login';
import { NotFound } from './pages/NotFound';
import { Projects } from './pages/Projects';
import { Solicitud } from './pages/Solicitud';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route path="login" element={<Login />} />
          <Route element={<Layout />}>
            <Route index element={<Projects />} />
            <Route path="proyectos/:id" element={<Desglose />} />
            <Route path="proyectos/:id/inventario" element={<InventoryCheck />} />
            <Route path="proyectos/:id/solicitud" element={<Solicitud />} />
            <Route path="proyectos/:id/comparador" element={<Comparador />} />
            <Route path="inventario" element={<InventoryList />} />
            <Route path="inventario/:itemId" element={<ItemDetail />} />
            <Route path="proveedores" element={<Suppliers />} />
            <Route path="cotizaciones" element={<Quotes />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  </StrictMode>,
);
