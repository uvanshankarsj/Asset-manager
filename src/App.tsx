import Sidebar from "./components/Sidebar";
import Content from "./components/Content";
import Login from "./components/Login";
import { useToast } from "./components/Toast";
import { useCallback, useEffect, useState } from "react";
import { TABS } from "./App.interface";
import {
  fetchMe,
  getToken,
  setToken,
  setUnauthorizedHandler,
  type AuthUser,
} from "./api";

function App() {
  const [selectedTab, setSelectedTab] = useState<TABS>(TABS.HOME);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const toast = useToast();
  // While a saved token is being checked we show nothing instead of flashing the login page
  const [checking, setChecking] = useState(() => !!getToken());

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setSelectedTab(TABS.HOME);
    setMenuOpen(false);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
      toast.error("Your session has expired. Please log in again.");
    });
    if (!getToken()) return;
    fetchMe()
      .then(setUser)
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [logout, toast]);

  if (checking) return null;

  if (!user) {
    return (
      <Login
        onAuthenticated={(token, u) => {
          setToken(token);
          setUser(u);
        }}
      />
    );
  }

  return (
    <div className="app-shell">
      <div className="topbar">
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setMenuOpen(true)}
        >
          {"☰"}
        </button>
        <span>{selectedTab}</span>
      </div>
      <div
        className={`app-backdrop${menuOpen ? " open" : ""}`}
        onClick={() => setMenuOpen(false)}
      />
      <aside className={`app-sidebar${menuOpen ? " open" : ""}`}>
        <Sidebar
          setSelectedTab={(tab) => {
            setSelectedTab(tab);
            setMenuOpen(false);
          }}
          selectedTab={selectedTab}
          user={user}
          onUserChange={setUser}
          onLogout={logout}
        />
      </aside>
      <main className="app-content">
        <Content selectedTab={selectedTab} />
      </main>
    </div>
  );
}
export default App;
