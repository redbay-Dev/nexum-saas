import { Routes, Route } from "react-router";

export function App(): React.JSX.Element {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <div className="flex min-h-screen items-center justify-center">
            <div className="text-center">
              <h1 className="text-4xl font-bold">Nexum</h1>
              <p className="mt-2 text-muted-foreground">
                Multi-tenant SaaS for Australian transport and logistics
              </p>
            </div>
          </div>
        }
      />
    </Routes>
  );
}
