import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { App } from "./App";
import { QUERIES } from "./api/queries";
import "./styles/app.css";

const root = document.getElementById("root");
if (root === null) {
  throw new Error("index.html has no #root element");
}

// Start both fonts now. A font otherwise loads only when its first text renders, and text that
// arrives with data (the check names in Geist Mono) stayed invisible (M0 part 7 spec, P7.5).
for (const family of ['"Lexend Variable"', '"Geist Mono Variable"']) {
  void document.fonts.load(`1em ${family}`);
}

const queryClient = new QueryClient({ defaultOptions: { queries: QUERIES } });
// A data router around the app's own routes, so a page may block leaving (useBlocker, #391).
const router = createBrowserRouter([{ path: "*", element: <App /> }]);

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
