import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from "react-router-dom";
import { StoreProvider, useStore } from "./app/store";
import { Layout } from "./components/Layout";
import { Auth } from "./pages/Auth";
import { Dashboard } from "./pages/Dashboard";
import { Inventory, ItemDetail } from "./pages/Inventory";
import { Projects, ProjectDetail } from "./pages/Projects";
import { Dispatches, DispatchDetail } from "./pages/Dispatches";
import { Suppliers, Quotes, QuoteDetail } from "./pages/Procurement";
import { Account, Activity, Members } from "./pages/Administration";
import { Empty } from "./components/ui";
import "./styles.css";
function Protected() {
  const { user, loading } = useStore();
  if (loading)
    return (
      <div className="loading-screen">
        <span className="spinner" />
        Preparando el espacio de operaciones…
      </div>
    );
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
function Application() {
  return (
    <Routes>
      <Route path="login" element={<Auth />} />
      <Route path="activar" element={<Auth />} />
      <Route element={<Protected />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="proyectos" element={<Projects />} />
          <Route path="proyectos/:id" element={<ProjectDetail />} />
          <Route path="proyectos/:id/cotizacion" element={<QuoteDetail />} />
          <Route path="proyectos/:id/inventario" element={<ProjectDetail />} />
          <Route path="proyectos/:id/solicitud" element={<QuoteDetail />} />
          <Route path="proyectos/:id/comparador" element={<QuoteDetail />} />
          <Route path="inventario" element={<Inventory />} />
          <Route path="inventario/:itemId" element={<ItemDetail />} />
          <Route path="salidas" element={<Dispatches />} />
          <Route path="salidas/:id" element={<DispatchDetail />} />
          <Route path="proveedores" element={<Suppliers />} />
          <Route path="cotizaciones" element={<Quotes />} />
          <Route path="cuenta" element={<Account />} />
          <Route path="equipo" element={<Members />} />
          <Route path="actividad" element={<Activity />} />
          <Route
            path="*"
            element={
              <Empty
                title="Esta página no existe"
                text="Usa el menú para volver a tu espacio de trabajo."
              />
            }
          />
        </Route>
      </Route>
    </Routes>
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StoreProvider>
      <BrowserRouter>
        <Application />
      </BrowserRouter>
    </StoreProvider>
  </StrictMode>,
);
